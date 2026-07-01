import crypto from 'node:crypto';
import axios from 'axios';

const WEB_PLAYER_BASE_URL = 'https://play.qobuz.com';
const API_BASE_URL = 'https://www.qobuz.com/api.json/0.2/';

export type QobuzCredentials = {
  appId: string;
  secret: string;
};

export type LoginResult = {
  user: {
    id: number;
    email: string;
    login: string;
  };
  user_auth_token: string;
};

async function fetchBundle(): Promise<{ html: string; bundle: string }> {
  const loginPage = await axios.get(`${WEB_PLAYER_BASE_URL}/login`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
    },
  });

  const html = typeof loginPage.data === 'string' ? loginPage.data : '';
  const bundleMatch = html.match(
    /<script src="(\/resources\/\d+\.\d+\.\d+-[a-z]\d{3}\/bundle\.js)">\s*<\/script>/
  );
  if (!bundleMatch) {
    throw new Error('Could not find bundle.js link in Qobuz login page');
  }

  const bundleUrl = `${WEB_PLAYER_BASE_URL}${bundleMatch[1]}`;
  const bundleResponse = await axios.get(bundleUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
    },
  });
  const bundle =
    typeof bundleResponse.data === 'string' ? bundleResponse.data : '';
  return { html, bundle };
}

function extractAppId(bundle: string): string {
  const appIdMatch = bundle.match(
    /production:{api:{appId:"(\d{9})",appSecret:"(\w{32})"/
  );
  if (!appIdMatch) {
    throw new Error('Could not extract app_id from bundle.js');
  }
  return appIdMatch[1];
}

function extractCandidateSecrets(bundle: string): string[] {
  const seedRegex =
    /[a-z]\.initialSeed\("([\w=]+)",window\.utimezone\.([a-z]+)\)/g;
  const candidates: Map<string, string[]> = new Map();

  let match: RegExpExecArray | null;
  while ((match = seedRegex.exec(bundle)) !== null) {
    const seed = match[1];
    const timezone = match[2];
    candidates.set(timezone, [seed]);
  }

  if (candidates.size === 0) {
    throw new Error('Could not extract seeds from bundle.js');
  }

  const timezones = Array.from(candidates.keys())
    .map((tz) => tz.charAt(0).toUpperCase() + tz.slice(1))
    .join('|');
  const infoExtrasRegex = new RegExp(
    `name:"\\w+/(?:${timezones})",info:"([\\w=]+)",extras:"([\\w=]+)"`,
    'g'
  );

  while ((match = infoExtrasRegex.exec(bundle)) !== null) {
    const fullMatch = match[0];
    const timezoneMatch = fullMatch.match(/\/([A-Za-z]+)",info:/);
    if (!timezoneMatch) continue;
    const timezone = timezoneMatch[1].toLowerCase();
    if (!candidates.has(timezone)) continue;
    const existing = candidates.get(timezone);
    if (existing) {
      existing.push(match[1], match[2]);
    }
  }

  const decoded: string[] = [];
  for (const parts of candidates.values()) {
    if (parts.length < 3) continue;
    const combined = parts.join('').slice(0, -44);
    try {
      const secret = Buffer.from(combined, 'base64').toString('utf-8');
      if (secret) decoded.push(secret);
    } catch {
      // ignore invalid base64
    }
  }

  return decoded;
}

async function testSecret(appId: string, secret: string): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000);
  const rSig = `trackgetFileUrlformat_id27intentstreamtrack_id1${timestamp}${secret}`;
  const rSigHashed = crypto.createHash('md5').update(rSig).digest('hex');

  const url = new URL(API_BASE_URL + 'track/getFileUrl');
  url.searchParams.append('format_id', '27');
  url.searchParams.append('intent', 'stream');
  url.searchParams.append('track_id', '1');
  url.searchParams.append('request_ts', String(timestamp));
  url.searchParams.append('request_sig', rSigHashed);

  try {
    const response = await axios.get(url.toString(), {
      headers: { 'X-App-Id': appId },
    });
    return response.status !== 400;
  } catch (err) {
    if (isAxiosErrorWithStatus(err, 400)) {
      return false;
    }
    return true;
  }
}

function isAxiosErrorWithStatus(err: unknown, status: number): boolean {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'status' in err.response &&
    err.response.status === status
  ) {
    return true;
  }
  return false;
}

export async function fetchWebPlayerCredentials(): Promise<QobuzCredentials> {
  const { bundle } = await fetchBundle();
  const appId = extractAppId(bundle);
  const candidates = extractCandidateSecrets(bundle);

  for (const secret of candidates) {
    if (await testSecret(appId, secret)) {
      return { appId, secret };
    }
  }

  throw new Error(
    'Could not find valid app_secret from Qobuz web player bundle'
  );
}

async function tryLoginRequest(
  credentials: QobuzCredentials,
  params: Record<string, string>
): Promise<LoginResult | null> {
  const { promise, resolve } = Promise.withResolvers<LoginResult | null>();

  const attempts = [
    { method: 'GET' as const, params },
    { method: 'POST' as const, data: params },
  ];

  for (const attempt of attempts) {
    try {
      const response = await axios({
        method: attempt.method,
        url: API_BASE_URL + 'user/login',
        ...(attempt.method === 'GET'
          ? { params: attempt.params }
          : { data: attempt.params }),
        headers: {
          'X-App-Id': credentials.appId,
          'User-Agent': 'qobuz-dl-cli',
        },
      });
      resolve(response.data as LoginResult);
      return promise;
    } catch (err) {
      if (!isAxiosErrorWithStatus(err, 401)) {
        resolve(null);
        return promise;
      }
    }
  }

  resolve(null);
  return promise;
}

export async function loginWithEmail(
  credentials: QobuzCredentials,
  email: string,
  password: string
): Promise<LoginResult> {
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
  const result = await tryLoginRequest(credentials, {
    email,
    password: hashedPassword,
  });
  if (result) return result;

  const usernameResult = await tryLoginRequest(credentials, {
    username: email,
    password: hashedPassword,
  });
  if (usernameResult) return usernameResult;

  throw new Error('Invalid Qobuz credentials or account requires 2FA');
}

export async function loginWithUsername(
  credentials: QobuzCredentials,
  username: string,
  password: string
): Promise<LoginResult> {
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
  const result = await tryLoginRequest(credentials, {
    username,
    password: hashedPassword,
  });
  if (result) return result;
  throw new Error('Invalid Qobuz credentials or account requires 2FA');
}

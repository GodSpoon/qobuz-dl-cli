import crypto from 'node:crypto';
import axios, { type AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type {
  ApiOptions,
  Config,
  FetchedQobuzAlbum,
  QobuzArtist,
  QobuzSearchResults,
} from './types.js';

const QOBUZ_ALBUM_URL_REGEX =
  /https:\/\/(play|open)\.qobuz\.com\/album\/[a-zA-Z0-9]+/;
const QOBUZ_TRACK_URL_REGEX =
  /https:\/\/(play|open)\.qobuz\.com\/track\/\d+/;
const QOBUZ_ARTIST_URL_REGEX =
  /https:\/\/(play|open)\.qobuz\.com\/artist\/\d+/;

function getRandomToken(tokens: string[]): string {
  return tokens[Math.floor(Math.random() * tokens.length)] ?? '';
}

function buildAxiosConfig(
  config: Config,
  country: string | undefined,
  extra: AxiosRequestConfig = {}
): AxiosRequestConfig {
  const token = country
    ? config.country === country
      ? getTokenForCountry(config, country)
      : getRandomToken(config.tokens)
    : getRandomToken(config.tokens);

  const proxyAgent = config.socks5Proxy
    ? new SocksProxyAgent('socks5://' + config.socks5Proxy)
    : undefined;

  return {
    headers: {
      'x-app-id': config.appId,
      'x-user-auth-token': token,
      ...(config.corsProxy ? { 'User-Agent': 'qobuz-dl-cli' } : {}),
    },
    httpAgent: proxyAgent,
    httpsAgent: proxyAgent,
    ...extra,
  };
}

function getTokenForCountry(config: Config, country: string): string {
  return (
    (config.country && config.country.toUpperCase() === country.toUpperCase()
      ? getRandomToken(config.tokens)
      : undefined) ?? getRandomToken(config.tokens)
  );
}

function applyCorsProxy(config: Config, url: string): string {
  return config.corsProxy ? config.corsProxy + encodeURIComponent(url) : url;
}

function parseQobuzUrl(
  query: string
): { id: string; switchTo: 'albums' | 'tracks' | 'artists' } | null {
  const albumMatch = query.trim().match(QOBUZ_ALBUM_URL_REGEX);
  if (albumMatch) {
    const id = albumMatch[0]
      .replace('https://open', '')
      .replace('https://play', '')
      .replace('.qobuz.com/album/', '');
    return { id, switchTo: 'albums' };
  }
  const trackMatch = query.trim().match(QOBUZ_TRACK_URL_REGEX);
  if (trackMatch) {
    const id = trackMatch[0]
      .replace('https://open', '')
      .replace('https://play', '')
      .replace('.qobuz.com/track/', '');
    return { id, switchTo: 'tracks' };
  }
  const artistMatch = query.trim().match(QOBUZ_ARTIST_URL_REGEX);
  if (artistMatch) {
    const id = artistMatch[0]
      .replace('https://open', '')
      .replace('https://play', '')
      .replace('.qobuz.com/artist/', '');
    return { id, switchTo: 'artists' };
  }
  return null;
}

function getApiBase(config: Config): string {
  return process.env.QOBUZ_API_BASE ?? 'https://www.qobuz.com/api.json/0.2/';
}

export async function search(
  config: Config,
  query: string,
  limit = 10,
  offset = 0,
  options: ApiOptions = {}
): Promise<QobuzSearchResults> {
  const base = getApiBase(config);
  const parsedUrl = parseQobuzUrl(query);
  const url = new URL(base + 'catalog/search');
  url.searchParams.append('query', parsedUrl?.id ?? query);
  url.searchParams.append('limit', String(limit));
  url.searchParams.append('offset', String(offset));

  const response = await axios.get(
    applyCorsProxy(config, url.toString()),
    buildAxiosConfig(config, options.country)
  );

  return {
    ...response.data,
    switchTo: parsedUrl?.switchTo ?? null,
  } as QobuzSearchResults;
}

export async function getAlbumInfo(
  config: Config,
  albumId: string,
  options: ApiOptions = {}
): Promise<FetchedQobuzAlbum> {
  const base = getApiBase(config);
  const url = new URL(base + 'album/get');
  url.searchParams.append('album_id', albumId);
  url.searchParams.append('extra', 'track_ids');

  const response = await axios.get(
    applyCorsProxy(config, url.toString()),
    buildAxiosConfig(config, options.country)
  );
  return response.data as FetchedQobuzAlbum;
}

export async function getArtist(
  config: Config,
  artistId: string,
  options: ApiOptions = {}
): Promise<QobuzArtist> {
  const base = getApiBase(config);
  const url = new URL(base + 'artist/page');

  const response = await axios.get(
    applyCorsProxy(config, url.toString()),
    buildAxiosConfig(config, options.country, {
      params: { artist_id: artistId, sort: 'release_date' },
    })
  );
  return response.data as QobuzArtist;
}

export async function getArtistReleases(
  config: Config,
  artistId: string,
  releaseType = 'album',
  limit = 10,
  offset = 0,
  trackSize = 1000,
  options: ApiOptions = {}
): Promise<unknown> {
  const base = getApiBase(config);
  const url = new URL(base + 'artist/getReleasesList');
  url.searchParams.append('artist_id', artistId);
  url.searchParams.append('release_type', releaseType);
  url.searchParams.append('limit', String(limit));
  url.searchParams.append('offset', String(offset));
  url.searchParams.append('track_size', String(trackSize));
  url.searchParams.append('sort', 'release_date');

  const response = await axios.get(
    applyCorsProxy(config, url.toString()),
    buildAxiosConfig(config, options.country)
  );
  return response.data;
}

export async function getDownloadURL(
  config: Config,
  trackId: number,
  quality: string,
  options: ApiOptions = {}
): Promise<string> {
  const base = getApiBase(config);
  const timestamp = Math.floor(Date.now() / 1000);
  const rSig = `trackgetFileUrlformat_id${quality}intentstreamtrack_id${trackId}${timestamp}${config.secret}`;
  const rSigHashed = crypto.createHash('md5').update(rSig).digest('hex');

  const url = new URL(base + 'track/getFileUrl');
  url.searchParams.append('format_id', quality);
  url.searchParams.append('intent', 'stream');
  url.searchParams.append('track_id', String(trackId));
  url.searchParams.append('request_ts', String(timestamp));
  url.searchParams.append('request_sig', rSigHashed);

  const response = await axios.get(
    applyCorsProxy(config, url.toString()),
    buildAxiosConfig(config, options.country)
  );
  if (
    response.data &&
    typeof response.data === 'object' &&
    'url' in response.data &&
    typeof response.data.url === 'string'
  ) {
    return response.data.url;
  }
  throw new Error('Qobuz API did not return a download URL');
}

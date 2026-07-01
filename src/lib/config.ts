import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { Config, OutputCodec, Quality } from './types.js';

const configDir = join(homedir(), '.config', 'qobuz-dl');
const configPath = join(configDir, 'config.json');

const qualitySchema = z.enum(['27', '7', '6', '5']).default('27');
const codecSchema = z.enum(['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS']).default('FLAC');

const configSchema = z.object({
  appId: z.string().min(1),
  secret: z.string().min(1),
  tokens: z.array(z.string().min(1)).min(1),
  country: z.string().optional(),
  quality: qualitySchema,
  codec: codecSchema,
  bitrate: z.number().min(24).max(320).optional(),
  applyMetadata: z.boolean().default(true),
  fixMD5: z.boolean().default(false),
  albumArtSize: z.number().min(100).max(3600).default(3600),
  albumArtQuality: z.number().min(0.1).max(1).default(1),
  trackTemplate: z.string().default('{artists} - {name}'),
  albumTemplate: z.string().default('{artists} - {name}'),
  outDir: z.string().default('.'),
  socks5Proxy: z.string().optional(),
  corsProxy: z.string().optional()
});

export type RawConfig = z.infer<typeof configSchema>;

const envBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  return value === '1' || value.toLowerCase() === 'true';
};

const envNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const envJsonArray = (value: string | undefined): string[] | undefined => {
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export function getConfigPath(): string {
  return configPath;
}

export function loadRawConfig(): Partial<RawConfig> {
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as unknown;
    return configSchema.partial().parse(raw);
  } catch {
    return {};
  }
}

export function saveConfig(config: RawConfig): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(configPath, 0o600);
  } catch {
    // ignore platforms that don't support chmod
  }
}

export function buildConfig(overrides: Partial<RawConfig> = {}): Config {
  const fileConfig = loadRawConfig();

  const envConfig: Partial<RawConfig> = {};
  if (process.env.QOBUZ_DL_APP_ID) envConfig.appId = process.env.QOBUZ_DL_APP_ID;
  if (process.env.QOBUZ_DL_SECRET) envConfig.secret = process.env.QOBUZ_DL_SECRET;
  const tokens = envJsonArray(process.env.QOBUZ_DL_TOKENS);
  if (tokens) envConfig.tokens = tokens;
  if (process.env.QOBUZ_DL_COUNTRY) envConfig.country = process.env.QOBUZ_DL_COUNTRY;
  if (process.env.QOBUZ_DL_QUALITY) {
    const parsed = qualitySchema.safeParse(process.env.QOBUZ_DL_QUALITY);
    if (parsed.success) envConfig.quality = parsed.data;
  }
  if (process.env.QOBUZ_DL_CODEC) {
    const parsed = codecSchema.safeParse(process.env.QOBUZ_DL_CODEC);
    if (parsed.success) envConfig.codec = parsed.data;
  }
  const bitrate = envNumber(process.env.QOBUZ_DL_BITRATE);
  if (bitrate !== undefined) envConfig.bitrate = bitrate;
  const applyMetadata = envBoolean(process.env.QOBUZ_DL_APPLY_METADATA);
  if (applyMetadata !== undefined) envConfig.applyMetadata = applyMetadata;
  const fixMD5 = envBoolean(process.env.QOBUZ_DL_FIX_MD5);
  if (fixMD5 !== undefined) envConfig.fixMD5 = fixMD5;
  const albumArtSize = envNumber(process.env.QOBUZ_DL_ALBUM_ART_SIZE);
  if (albumArtSize !== undefined) envConfig.albumArtSize = albumArtSize;
  const albumArtQuality = envNumber(process.env.QOBUZ_DL_ALBUM_ART_QUALITY);
  if (albumArtQuality !== undefined) envConfig.albumArtQuality = albumArtQuality;
  if (process.env.QOBUZ_DL_TRACK_TEMPLATE) envConfig.trackTemplate = process.env.QOBUZ_DL_TRACK_TEMPLATE;
  if (process.env.QOBUZ_DL_ALBUM_TEMPLATE) envConfig.albumTemplate = process.env.QOBUZ_DL_ALBUM_TEMPLATE;
  if (process.env.QOBUZ_DL_OUT_DIR) envConfig.outDir = process.env.QOBUZ_DL_OUT_DIR;
  if (process.env.QOBUZ_DL_SOCKS5_PROXY) envConfig.socks5Proxy = process.env.QOBUZ_DL_SOCKS5_PROXY;
  if (process.env.QOBUZ_DL_CORS_PROXY) envConfig.corsProxy = process.env.QOBUZ_DL_CORS_PROXY;

  const merged = configSchema.parse({
    ...fileConfig,
    ...envConfig,
    ...overrides
  });

  return {
    ...merged,
    outDir: merged.outDir || '.'
  } as Config;
}

export function maskConfig(config: Config): Omit<Config, 'secret' | 'tokens'> & { secret: string; tokens: string[] } {
  return {
    ...config,
    secret: '***',
    tokens: config.tokens.map(() => '***')
  };
}

export function setConfigKey(key: keyof RawConfig, value: string): void {
  const current = loadRawConfig();
  const parsed = configSchema.partial().parse({
    ...current,
    [key]: value
  });
  const full = configSchema.parse({ ...configSchema.parse({}), ...parsed });
  saveConfig(full);
}

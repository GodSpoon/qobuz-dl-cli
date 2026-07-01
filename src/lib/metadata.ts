import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import axios from 'axios';
import type { Config, OutputCodec, QobuzTrack } from './types.js';
import {
  formatArtists,
  formatTitle,
  getAlbum,
  getFullResImageUrl,
} from './naming.js';

export const codecMap: Record<
  OutputCodec,
  { extension: string; codec: string }
> = {
  FLAC: { extension: 'flac', codec: 'flac' },
  WAV: { extension: 'wav', codec: 'pcm_s16le' },
  ALAC: { extension: 'm4a', codec: 'alac' },
  MP3: { extension: 'mp3', codec: 'libmp3lame' },
  AAC: { extension: 'm4a', codec: 'aac' },
  OPUS: { extension: 'opus', codec: 'libopus' },
};

async function runFfmpeg(
  args: string[],
  onProgress?: (line: string) => void
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderr = '';
  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    onProgress?.(text);
  });

  ffmpeg.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
    }
  });

  ffmpeg.on('error', (err) => reject(err));
  return promise;
}

export function needsReencode(config: Config): boolean {
  const sourceIsMp3 = config.quality === '5';
  const passThroughFlac = config.codec === 'FLAC' && !sourceIsMp3;
  const passThroughMp3 = config.codec === 'MP3' && sourceIsMp3 && config.bitrate === 320;
  return !(passThroughFlac || passThroughMp3);
}

export async function fetchAlbumArt(
  track: QobuzTrack,
  size: number,
  quality: number
): Promise<Buffer | null> {
  const imageUrl = getFullResImageUrl(track);
  try {
    const resized = await resizeImage(imageUrl, size, quality);
    if (!resized) return null;
    const response = await axios.get(resized, { responseType: 'arraybuffer' });
    return Buffer.from(response.data as ArrayBuffer);
  } catch {
    return null;
  }
}

async function resizeImage(
  imageURL: string,
  maxSize: number,
  quality: number
): Promise<string | null> {
  const { promise, resolve } = Promise.withResolvers<string | null>();
  // Node-side canvas not available; if image dimensions unknown, return original URL.
  // A real implementation would probe dimensions with ffprobe or sharp.
  resolve(imageURL);
  return promise;
}

export async function applyMetadata(
  config: Config,
  trackBuffer: Buffer,
  track: QobuzTrack,
  albumArt?: Buffer | null,
  upc?: string
): Promise<Buffer> {
  const codec = codecMap[config.codec];
  const extension = codec.extension;
  const skipReencode = !needsReencode(config);

  if (skipReencode && !config.applyMetadata) {
    return trackBuffer;
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'qobuz-dl-'));
  try {
    let currentBuffer = trackBuffer;

    if (!skipReencode) {
      const sourceIsMp3 = config.quality === '5';
      const inputExtension = sourceIsMp3 ? 'mp3' : 'flac';
      await writeFile(join(tmpDir, `input.${inputExtension}`), trackBuffer);

      const args = [
        '-i',
        `input.${inputExtension}`,
        '-c:a',
        codec.codec,
      ];
      if (config.bitrate) {
        args.push('-b:a', `${config.bitrate}k`);
      }
      if (config.codec === 'OPUS') {
        args.push('-vbr', 'on');
      }
      args.push(`output.${extension}`);

      await runFfmpeg(args.map(String));
      currentBuffer = await readFile(join(tmpDir, `output.${extension}`));
    }

    if (!config.applyMetadata || config.codec === 'WAV') {
      return currentBuffer;
    }

    const album = getAlbum(track);
    const artists =
      album.artists && album.artists.length > 0
        ? album.artists
        : track.performer
          ? [track.performer]
          : [];

    let metadata = ';FFMETADATA1';
    metadata += `\ntitle=${formatTitle(track)}`;
    if (artists.length > 0) {
      metadata += `\nartist=${formatArtists(track)}`;
      metadata += `\nalbum_artist=${artists[0]?.name ?? 'Various Artists'}`;
    } else {
      metadata += `\nartist=Various Artists`;
      metadata += `\nalbum_artist=Various Artists`;
    }
    metadata += `\nalbum=${formatTitle(album)}`;
    metadata += `\ngenre=${album.genre.name}`;
    metadata += `\ndate=${album.release_date_original}`;
    metadata += `\nyear=${new Date(album.release_date_original).getFullYear()}`;
    metadata += `\nlabel=${album.label.name}`;
    metadata += `\ncopyright=${track.copyright}`;
    if (track.isrc) metadata += `\nisrc=${track.isrc}`;
    if (upc) metadata += `\nbarcode=${upc}`;
    if (track.track_number) metadata += `\ntrack=${track.track_number}`;

    await writeFile(join(tmpDir, `input.${extension}`), currentBuffer);
    await writeFile(join(tmpDir, 'metadata.txt'), metadata);

    const hasCover = albumArt !== null && albumArt !== undefined;
    if (hasCover) {
      await writeFile(join(tmpDir, 'albumArt.jpg'), albumArt as Buffer);
    }

    await runFfmpeg([
      '-i',
      `input.${extension}`,
      '-i',
      'metadata.txt',
      '-map_metadata',
      '1',
      '-codec',
      'copy',
      `tagged.${extension}`,
    ]);

    if (config.codec === 'OPUS' || !hasCover) {
      return readFile(join(tmpDir, `tagged.${extension}`));
    }

    await runFfmpeg([
      '-i',
      `tagged.${extension}`,
      '-i',
      'albumArt.jpg',
      '-c',
      'copy',
      '-map',
      '0',
      '-map',
      '1',
      '-disposition:v:0',
      'attached_pic',
      `final.${extension}`,
    ]);

    return readFile(join(tmpDir, `final.${extension}`));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

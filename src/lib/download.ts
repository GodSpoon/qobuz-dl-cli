import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { writeFile, rm, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import type { Config, FetchedQobuzAlbum, QobuzTrack } from './types.js';
import { getDownloadURL } from './qobuz-api.js';
import { applyMetadata, codecMap, fetchAlbumArt } from './metadata.js';
import {
  buildTrackPath,
  cleanFileName,
  formatCustomTitle,
  getFullResImageUrl,
} from './naming.js';

export type DownloadProgress =
  | { type: 'start'; track: QobuzTrack }
  | { type: 'progress'; track: QobuzTrack; loaded: number; total: number }
  | { type: 'done'; track: QobuzTrack; path: string }
  | { type: 'error'; track: QobuzTrack; error: string };

export async function downloadTrack(
  config: Config,
  track: QobuzTrack,
  outPath: string,
  onProgress?: (event: DownloadProgress) => void,
  albumArt?: Buffer | null,
  upc?: string
): Promise<string> {
  onProgress?.({ type: 'start', track });
  const url = await getDownloadURL(config, track.id, config.quality, {
    country: config.country,
  });

  const head = await axios.head(url);
  const total =
    typeof head.headers['content-length'] === 'string'
      ? Number(head.headers['content-length'])
      : 0;

  const response = await axios.get(url, {
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      onProgress?.({
        type: 'progress',
        track,
        loaded: progressEvent.loaded,
        total,
      });
    },
  });

  const tmpFile = outPath + '.tmp';
  const writer = createWriteStream(tmpFile);
  await pipeline(response.data as NodeJS.ReadableStream, writer);

  const inputBuffer = await readFile(tmpFile);
  await rm(tmpFile, { force: true });

  const outputBuffer = await applyMetadata(config, inputBuffer, track, albumArt, upc);

  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await writeFile(outPath, outputBuffer);

  onProgress?.({ type: 'done', track, path: outPath });
  return outPath;
}

export async function downloadAlbum(
  config: Config,
  album: FetchedQobuzAlbum,
  onProgress?: (event: DownloadProgress) => void
): Promise<string[]> {
  const albumDirName = cleanFileName(formatCustomTitle(config.albumTemplate, album));
  const albumDir = join(config.outDir, albumDirName);
  if (!existsSync(albumDir)) mkdirSync(albumDir, { recursive: true });

  const tracks = album.tracks.items.map((track) => ({
    ...track,
    album,
  })) as QobuzTrack[];

  const albumArt = config.applyMetadata
    ? await fetchAlbumArt(tracks[0] as QobuzTrack, config.albumArtSize, config.albumArtQuality)
    : null;

  if (albumArt) {
    await writeFile(join(albumDir, 'cover.jpg'), albumArt);
  }

  const padWidth = Math.max(String(tracks.length).length, 2);
  const extension = codecMap[config.codec].extension;
  const results: string[] = [];

  for (const track of tracks) {
    if (!track.streamable) continue;
    const outPath = buildTrackPath(albumDir, config.trackTemplate, track, extension, padWidth);
    try {
      const path = await downloadTrack(config, track, outPath, onProgress, albumArt, album.upc);
      results.push(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress?.({ type: 'error', track, error: message });
    }
  }

  return results;
}

export { getFullResImageUrl };

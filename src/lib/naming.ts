import { join } from 'node:path';
import type { QobuzAlbum, QobuzTrack } from './types.js';

export function getAlbum(input: QobuzAlbum | QobuzTrack): QobuzAlbum {
  return 'image' in input ? input : input.album;
}

export function formatTitle(input: QobuzAlbum | QobuzTrack): string {
  const title = input.title;
  const version = 'version' in input ? input.version : null;
  return `${title}${version ? ` (${version})` : ''}`.trim();
}

export function formatArtists(
  input: QobuzAlbum | QobuzTrack,
  separator = ', '
): string {
  const album = getAlbum(input);
  if (album.artists && album.artists.length > 0) {
    return album.artists.map((artist) => artist.name).join(separator);
  }
  if ('performer' in input && input.performer) {
    return input.performer.name;
  }
  return 'Various Artists';
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0m';
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const remainingSeconds = seconds % 60;
  return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes > 0 ? `${remainingMinutes}m ` : ''}${remainingSeconds > 0 && hours <= 0 ? `${remainingSeconds}s` : ''}`.trim();
}

export function formatCustomTitle(
  template: string,
  result: QobuzAlbum | QobuzTrack
): string {
  return template
    .replaceAll('{artists}', formatArtists(result))
    .replaceAll('{name}', formatTitle(result))
    .replaceAll('{year}', String(new Date(result.released_at * 1000).getFullYear()))
    .replaceAll('{duration}', formatDuration(result.duration));
}

export function cleanFileName(filename: string): string {
  const bannedChars = ['/', '\\', '?', ':', '*', '"', '<', '>', '|'];
  let result = filename;
  for (const char of bannedChars) {
    result = result.replaceAll(char, '_');
  }
  return result;
}

export function getFullResImageUrl(input: QobuzAlbum | QobuzTrack): string {
  const album = getAlbum(input);
  return album.image.large.substring(0, album.image.large.length - 7) + 'org.jpg';
}

export function buildTrackPath(
  outDir: string,
  template: string,
  track: QobuzTrack,
  extension: string,
  padWidth: number
): string {
  const fileName = `${(track.track_number).toString().padStart(padWidth, '0')} ${formatCustomTitle(template, track)}.${extension}`;
  return join(outDir, cleanFileName(fileName));
}

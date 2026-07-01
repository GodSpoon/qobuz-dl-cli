import pc from 'picocolors';
import type { QobuzAlbum, QobuzArtist, QobuzTrack } from './types.js';
import { formatDuration, formatTitle, formatArtists } from './naming.js';

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printError(message: string): void {
  console.error(pc.red(`Error: ${message}`));
}

export function printAlbum(album: QobuzAlbum): void {
  console.log(`${pc.bold(formatTitle(album))} by ${formatArtists(album)}`);
  console.log(`  ID:    ${album.id}`);
  console.log(`  Year:  ${new Date(album.released_at * 1000).getFullYear()}`);
  console.log(`  Label: ${album.label.name}`);
  console.log(`  UPC:   ${album.upc}`);
}

export function printTrack(track: QobuzTrack): void {
  console.log(`${formatTitle(track)} by ${formatArtists(track)}`);
  console.log(`  ID:       ${track.id}`);
  console.log(`  Album:    ${formatTitle(track.album)}`);
  console.log(`  Duration: ${formatDuration(track.duration)}`);
}

export function printArtist(artist: QobuzArtist): void {
  console.log(pc.bold(artist.name));
  console.log(`  ID: ${artist.id}`);
  console.log(`  Albums: ${artist.albums_count}`);
}

export function formatSearchResult(
  item: QobuzAlbum | QobuzTrack | QobuzArtist,
  index: number
): string {
  if ('albums_count' in item) {
    return `${index + 1}. [Artist] ${item.name} (ID: ${item.id})`;
  }
  if ('album' in item) {
    return `${index + 1}. [Track] ${formatTitle(item)} by ${formatArtists(item)}`;
  }
  return `${index + 1}. [Album] ${formatTitle(item)} by ${formatArtists(item)} (ID: ${item.id})`;
}

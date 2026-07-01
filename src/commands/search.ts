import { Command } from 'commander';
import { search } from '../lib/qobuz-api.js';
import { buildConfig } from '../lib/config.js';
import { formatSearchResult, printJson } from '../lib/output.js';
import type { QobuzAlbum, QobuzArtist, QobuzTrack } from '../lib/types.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search Qobuz for albums, tracks, and artists')
    .option('-l, --limit <n>', 'Result limit', '10')
    .option('-o, --offset <n>', 'Result offset', '0')
    .option('--country <code>', 'Country code override')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options) => {
      try {
        const config = buildConfig({ country: options.country });
        const results = await search(
          config,
          query,
          Number(options.limit),
          Number(options.offset),
          { country: options.country }
        );

        if (options.json) {
          printJson({ ok: true, query, data: results });
          return;
        }

        const items: (QobuzAlbum | QobuzTrack | QobuzArtist)[] = [
          ...results.artists.items,
          ...results.albums.items,
          ...results.tracks.items,
        ];

        if (items.length === 0) {
          console.log('No results found.');
          return;
        }

        for (const [index, item] of items.entries()) {
          console.log(formatSearchResult(item, index));
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import { getArtistReleases } from '../lib/qobuz-api.js';
import { buildConfig } from '../lib/config.js';
import { printJson } from '../lib/output.js';

export function registerReleasesCommand(program: Command): void {
  program
    .command('releases <artist-id>')
    .description('List artist releases')
    .option('-t, --type <type>', 'Release type', 'album')
    .option('-l, --limit <n>', 'Limit', '10')
    .option('-o, --offset <n>', 'Offset', '0')
    .option('--country <code>', 'Country code override')
    .option('--json', 'Output as JSON')
    .action(async (artistId: string, options) => {
      try {
        const config = buildConfig({ country: options.country });
        const data = await getArtistReleases(
          config,
          artistId,
          options.type,
          Number(options.limit),
          Number(options.offset),
          1000,
          { country: options.country }
        );

        if (options.json) {
          printJson({ ok: true, data });
          return;
        }

        console.log(JSON.stringify(data, null, 2));
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

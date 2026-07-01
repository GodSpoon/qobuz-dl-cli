import { Command } from 'commander';
import { getArtist } from '../lib/qobuz-api.js';
import { buildConfig } from '../lib/config.js';
import { printArtist, printJson } from '../lib/output.js';

export function registerArtistCommand(program: Command): void {
  program
    .command('artist <id|url>')
    .description('Show artist information')
    .option('--country <code>', 'Country code override')
    .option('--json', 'Output as JSON')
    .action(async (idOrUrl: string, options) => {
      try {
        const config = buildConfig({ country: options.country });
        const artistId = idOrUrl.replace(/.*\/(artist\/)?/, '');
        const artist = await getArtist(config, artistId, { country: options.country });

        if (options.json) {
          printJson({ ok: true, data: artist });
          return;
        }

        printArtist(artist);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

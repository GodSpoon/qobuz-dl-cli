import { Command } from 'commander';
import { getAlbumInfo, search } from '../lib/qobuz-api.js';
import { buildConfig, type RawConfig } from '../lib/config.js';
import { downloadTrack } from '../lib/download.js';
import { codecMap } from '../lib/metadata.js';
import { cleanFileName, formatCustomTitle } from '../lib/naming.js';
import { printJson } from '../lib/output.js';
import { join } from 'node:path';

export function registerTrackCommand(program: Command): void {
  program
    .command('track <id|url>')
    .description('Download a single track')
    .option('--quality <q>', 'Quality override')
    .option('--codec <codec>', 'Output codec override')
    .option('--bitrate <n>', 'Bitrate override')
    .option('--out-dir <path>', 'Output directory override')
    .option('--country <code>', 'Country code override')
    .option('--json', 'Output as JSON')
    .action(async (idOrUrl: string, options) => {
      try {
        const overrides: Partial<RawConfig> = {
          country: options.country,
        };
        if (options.quality) overrides.quality = options.quality;
        if (options.codec) overrides.codec = options.codec;
        if (options.bitrate) overrides.bitrate = Number(options.bitrate);
        if (options.outDir) overrides.outDir = options.outDir;

        const config = buildConfig(overrides);
        const trackId = Number(idOrUrl.replace(/.*\/(track\/)?/, ''));

        // We need album context for metadata. Fetch track info through search as a fallback.
        const searchResults = await search(config, String(trackId), 1, 0, { country: options.country });
        const track = searchResults.tracks.items.find((t) => t.id === trackId);
        if (!track) {
          throw new Error(`Track ${trackId} not found`);
        }

        const extension = codecMap[config.codec].extension;
        const fileName = cleanFileName(`${formatCustomTitle(config.trackTemplate, track)}.${extension}`);
        const outPath = join(config.outDir, fileName);

        const path = await downloadTrack(config, track, outPath, (event) => {
          if (event.type === 'progress') {
            process.stdout.write(`\rDownloading: ${Math.round((event.loaded / event.total) * 100)}%`);
          }
        });

        console.log(`\nSaved to ${path}`);

        if (options.json) {
          printJson({ ok: true, path });
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

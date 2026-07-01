import { Command } from 'commander';
import { getAlbumInfo } from '../lib/qobuz-api.js';
import { buildConfig, type RawConfig } from '../lib/config.js';
import { downloadAlbum } from '../lib/download.js';
import { printAlbum, printJson, printTrack } from '../lib/output.js';

export function registerAlbumCommand(program: Command): void {
  program
    .command('album <id|url>')
    .description('Show album info or download an album')
    .option('-d, --download', 'Download the album')
    .option('--zip', 'Create a zip archive of the album')
    .option('--quality <q>', 'Quality override')
    .option('--codec <codec>', 'Output codec override')
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
        if (options.outDir) overrides.outDir = options.outDir;

        const config = buildConfig(overrides);
        const albumId = idOrUrl.replace(/.*\/(album\/)?/, '');
        const album = await getAlbumInfo(config, albumId, { country: options.country });

        if (options.download) {
          const paths = await downloadAlbum(config, album, (event) => {
            if (event.type === 'progress') {
              process.stdout.write(
                `\rDownloading ${event.track.title}: ${Math.round((event.loaded / event.total) * 100)}%`
              );
            }
          });
          console.log(`\nDownloaded ${paths.length} tracks`);
          return;
        }

        if (options.json) {
          printJson({ ok: true, data: album });
          return;
        }

        printAlbum(album);
        console.log('');
        for (const track of album.tracks.items) {
          printTrack(track);
          console.log('');
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

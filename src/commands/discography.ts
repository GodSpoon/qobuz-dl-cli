import { Command } from 'commander';
import { getArtistReleases } from '../lib/qobuz-api.js';
import { getAlbumInfo } from '../lib/qobuz-api.js';
import { buildConfig, type RawConfig } from '../lib/config.js';
import { downloadAlbum } from '../lib/download.js';
import { printJson } from '../lib/output.js';
import type { QobuzAlbum } from '../lib/types.js';

export function registerDiscographyCommand(program: Command): void {
  program
    .command('discography <id|url>')
    .description("Download an artist's discography")
    .option('-t, --type <type>', 'Release type', 'album')
    .option('--zip', 'Create zip archives for each album')
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
        const artistId = idOrUrl.replace(/.*\/(artist\/)?/, '');

        const releases = await getArtistReleases(
          config,
          artistId,
          options.type,
          1000,
          0,
          1000,
          { country: options.country }
        );

        const items = extractReleaseItems(releases);
        const paths: string[] = [];

        for (const album of items) {
          const fullAlbum = await getAlbumInfo(config, album.id, { country: options.country });
          const albumPaths = await downloadAlbum(config, fullAlbum);
          paths.push(...albumPaths);
        }

        console.log(`\nDownloaded ${paths.length} tracks`);

        if (options.json) {
          printJson({ ok: true, paths });
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

function extractReleaseItems(releases: unknown): QobuzAlbum[] {
  if (
    releases &&
    typeof releases === 'object' &&
    'items' in releases &&
    Array.isArray(releases.items)
  ) {
    return releases.items as QobuzAlbum[];
  }
  return [];
}

import { Command } from 'commander';
import { buildConfig, getConfigPath, loadRawConfig, maskConfig, saveConfig, setConfigKey } from '../lib/config.js';
import { printError, printJson } from '../lib/output.js';
import type { RawConfig } from '../lib/config.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program.command('config').description('Manage configuration');

  configCmd
    .command('init')
    .description('Create initial configuration interactively')
    .action(async () => {
      const readline = await import('node:readline/promises');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const ask = async (prompt: string): Promise<string> => {
        const answer = await rl.question(`${prompt}: `);
        return answer.trim();
      };

      try {
        const appId = await ask('Qobuz App ID');
        const secret = await ask('Qobuz Secret');
        const token = await ask('Qobuz Auth Token');
        const country = await ask('Country code (e.g. US, leave empty for default)');

        const config: RawConfig = {
          appId,
          secret,
          tokens: [token],
          ...(country ? { country } : {}),
          quality: '27',
          codec: 'FLAC',
          bitrate: 320,
          applyMetadata: true,
          fixMD5: false,
          albumArtSize: 3600,
          albumArtQuality: 1,
          trackTemplate: '{artists} - {name}',
          albumTemplate: '{artists} - {name}',
          outDir: '.',
        };
        saveConfig(config);
        console.log(`Configuration saved to ${getConfigPath()}`);
      } finally {
        rl.close();
      }
    });

  configCmd
    .command('get')
    .description('Print effective configuration')
    .option('--json', 'Output as JSON')
    .action((options) => {
      try {
        const config = buildConfig();
        if (options.json) {
          printJson({ ok: true, config: maskConfig(config) });
        } else {
          console.log(`Config file: ${getConfigPath()}`);
          console.log(JSON.stringify(maskConfig(config), null, 2));
        }
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(3);
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Update a config value')
    .action((key: string, value: string) => {
      try {
        setConfigKey(key as keyof RawConfig, value);
        console.log(`Updated ${key}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

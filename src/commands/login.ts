import { Command } from 'commander';
import { buildConfig, saveConfig, type RawConfig } from '../lib/config.js';
import { fetchWebPlayerCredentials, loginWithEmail } from '../lib/qobuz-auth.js';
import { printJson } from '../lib/output.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Log in to Qobuz and save credentials/token')
    .option('-e, --email <email>', 'Qobuz email')
    .option('-p, --password <password>', 'Qobuz password')
    .option('--app-id <id>', 'Qobuz app_id')
    .option('--secret <secret>', 'Qobuz app_secret')
    .option('--web-player', 'Fetch app_id/secret from Qobuz web player')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const readline = await import('node:readline/promises');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const email = options.email || process.env.QOBUZ_EMAIL || (await rl.question('Email: '));
        const password = options.password || process.env.QOBUZ_PASSWORD || (await rl.question('Password: '));

        let appId = options.appId;
        let secret = options.secret;

        if (!appId || !secret) {
          if (options.webPlayer) {
            console.log('Fetching credentials from Qobuz web player...');
            const creds = await fetchWebPlayerCredentials();
            appId = creds.appId;
            secret = creds.secret;
          } else {
            appId = appId || (await rl.question('App ID: '));
            secret = secret || (await rl.question('App Secret: '));
          }
        }

        rl.close();

        const result = await loginWithEmail({ appId, secret }, email, password);
        const config: RawConfig = {
          ...buildConfig({ appId, secret, tokens: [result.user_auth_token] }),
          appId,
          secret,
          tokens: [result.user_auth_token],
        };
        saveConfig(config);

        const message = `Logged in as ${result.user.login}. Token saved.`;
        if (options.json) {
          printJson({
            ok: true,
            user: result.user,
            token: result.user_auth_token,
          });
        } else {
          console.log(message);
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

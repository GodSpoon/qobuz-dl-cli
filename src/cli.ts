#!/usr/bin/env node
import { Command } from 'commander';
import { registerConfigCommand } from './commands/config.js';
import { registerSearchCommand } from './commands/search.js';
import { registerAlbumCommand } from './commands/album.js';
import { registerArtistCommand } from './commands/artist.js';
import { registerReleasesCommand } from './commands/releases.js';
import { registerTrackCommand } from './commands/track.js';
import { registerDiscographyCommand } from './commands/discography.js';
import { registerLoginCommand } from './commands/login.js';

const program = new Command()
  .name('qobuz-dl')
  .description('Standalone CLI for Qobuz-DL')
  .version('2.0.0');

registerConfigCommand(program);
registerSearchCommand(program);
registerAlbumCommand(program);
registerArtistCommand(program);
registerReleasesCommand(program);
registerTrackCommand(program);
registerDiscographyCommand(program);
registerLoginCommand(program);

program.parse();

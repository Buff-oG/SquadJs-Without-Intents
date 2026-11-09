import fs from 'fs';

import Logger from 'core/logger';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Plugins {
  constructor() {
    this.plugins = null;
  }

  async getPlugins(force = false) {
    if (this.plugins && !force) return this.plugins;

    this.plugins = {};

    const dir = await fs.promises.opendir(path.join(__dirname, './'));

    const pluginFilenames = [];
    for await (const dirent of dir) {
      // Check for non .js file type
      if (!dirent.isFile() || !dirent.name.endsWith('.js')) {
        continue;
      }
      if (
        [
          'index.js',
          'base-plugin.js',
          'discord-base-message-updater.js',
          'discord-base-plugin.js',
          'readme.md'
        ].includes(dirent.name)
      )
        continue;
      pluginFilenames.push(dirent.name);
    }

    for (const pluginFilename of pluginFilenames) {
      Logger.verbose('Plugins', 1, `Loading plugin file ${pluginFilename}...`);

      // A broken or empty plugin file should not take down the whole server.
      let Plugin;
      try {
        ({ default: Plugin } = await import(`./${pluginFilename}`));
      } catch (err) {
        Logger.verbose(
          'Plugins',
          1,
          `Skipping ${pluginFilename}: failed to import. ${err.message}`
        );
        continue;
      }

      if (typeof Plugin !== 'function' || !Plugin.name) {
        Logger.verbose(
          'Plugins',
          1,
          `Skipping ${pluginFilename}: no default exported plugin class found. ` +
            'A plugin file must "export default class ... extends BasePlugin".'
        );
        continue;
      }

      this.plugins[Plugin.name] = Plugin;
    }

    return this.plugins;
  }
}

export default new Plugins();

import { PermissionsBitField } from 'discord.js';

import BasePlugin from './base-plugin.js';

import { COPYRIGHT_MESSAGE } from '../utils/constants.js';

// Permissions every Discord plugin needs to post its embeds.
const REQUIRED_PERMISSIONS = [
  ['ViewChannel', PermissionsBitField.Flags.ViewChannel],
  ['SendMessages', PermissionsBitField.Flags.SendMessages],
  ['EmbedLinks', PermissionsBitField.Flags.EmbedLinks]
];

export default class DiscordBasePlugin extends BasePlugin {
  static get optionsSpecification() {
    return {
      discordClient: {
        required: true,
        description: 'Discord connector name.',
        connector: 'discord',
        default: 'discord'
      }
    };
  }

  async prepareToMount() {
    try {
      this.channel = await this.options.discordClient.channels.fetch(this.options.channelID);
    } catch (error) {
      this.channel = null;
      this.verbose(
        1,
        `Could not fetch Discord channel with channelID "${this.options.channelID}". Error: ${error.message}`
      );
      this.verbose(2, `${error.stack}`);
      return;
    }

    // The Guilds intent caches every channel in a guild, including ones the bot cannot
    // view, so a successful fetch does not imply the bot can actually post here. Report
    // that at startup rather than on the first event.
    const missing = this.missingPermissions();

    if (missing === null) {
      this.verbose(1, `Could not determine bot permissions in ${this.describeChannel()}.`);
    } else if (missing.length > 0) {
      this.verbose(
        1,
        `Bot is missing permission(s) [${missing.join(', ')}] in ${this.describeChannel()}. ` +
          'Grant them on the channel itself - channel overwrites take precedence over role permissions.'
      );
    }
  }

  /** Human readable channel identity, including the guild it belongs to. */
  describeChannel() {
    if (!this.channel) return `channel "${this.options.channelID}"`;

    const guild = this.channel.guild;
    const channelName = this.channel.name ? `#${this.channel.name}` : 'channel';

    return guild
      ? `${channelName} (${this.channel.id}) in guild "${guild.name}" (${guild.id})`
      : `${channelName} (${this.channel.id})`;
  }

  /** Names of the required permissions the bot lacks, or null if they cannot be resolved. */
  missingPermissions() {
    const me = this.channel?.guild?.members?.me;
    if (!me || typeof this.channel.permissionsFor !== 'function') return null;

    const permissions = this.channel.permissionsFor(me);
    if (!permissions) return null;

    return REQUIRED_PERMISSIONS.filter(([, flag]) => !permissions.has(flag)).map(([name]) => name);
  }

  async sendDiscordMessage(message) {
    if (!this.channel) {
      this.verbose(1, `Could not send Discord Message. Channel not initialized.`);
      return;
    }

    if (typeof message === 'object' && 'embed' in message) {
      message.embed.footer = message.embed.footer || { text: COPYRIGHT_MESSAGE };
      if (typeof message.embed.color === 'string')
        message.embed.color = parseInt(message.embed.color, 16);
      message = { ...message, embeds: [message.embed] };
    }

    // A rejection here used to escape as an unhandled promise rejection, which terminates
    // the process on Node 15+. Misconfigured channels should log, not kill SquadJS.
    try {
      await this.channel.send(message);
    } catch (error) {
      const missing = this.missingPermissions();
      const detail =
        missing && missing.length > 0 ? ` Missing permission(s): [${missing.join(', ')}].` : '';

      this.verbose(
        1,
        `Could not send Discord message to ${this.describeChannel()}: ${error.message}.${detail}`
      );
      this.verbose(2, `${error.stack}`);
    }
  }
}

import { registerCommand, toCommandName, unregisterCommand } from '../utils/discord-commands.js';

import BasePlugin from './base-plugin.js';

export default class DiscordPlaceholder extends BasePlugin {
  static get description() {
    return (
      'The <code>DiscordPlaceholder</code> plugin allows you to make your bot create placeholder messages that ' +
      'can be used when configuring other plugins.'
    );
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      discordClient: {
        required: true,
        description: 'Discord connector name.',
        connector: 'discord',
        default: 'discord'
      },
      command: {
        required: false,
        description: 'Slash command used to create a Discord placeholder message.',
        default: 'placeholder'
      },
      channelID: {
        required: false,
        description:
          'The bot will only answer with a placeholder on this channel. Leave empty to allow any channel.',
        default: ''
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.commandName = toCommandName(this.options.command);

    this.onCommandInteraction = this.onCommandInteraction.bind(this);
  }

  async mount() {
    registerCommand(
      this.options.discordClient,
      {
        name: this.commandName,
        description: 'Post a placeholder message for use when configuring other plugins.'
      },
      this.onCommandInteraction
    );
  }

  async unmount() {
    unregisterCommand(this.options.discordClient, this.commandName);
  }

  async onCommandInteraction(interaction) {
    if (this.options.channelID && interaction.channelId !== this.options.channelID) {
      await interaction.reply({
        content: 'That command cannot be used in this channel.',
        ephemeral: true
      });
      return;
    }

    // Send as a normal channel message so the ID can be reused by other plugins.
    const message = await interaction.channel.send('Placeholder.');

    await interaction.reply({
      content: `Placeholder created.\nChannel ID: \`${message.channel.id}\`\nMessage ID: \`${message.id}\``,
      ephemeral: true
    });
  }
}

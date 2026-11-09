import {
  ApplicationCommandOptionType,
  memberHasRole,
  registerCommand,
  toCommandName,
  unregisterCommand
} from '../utils/discord-commands.js';

import BasePlugin from './base-plugin.js';

export default class DiscordRcon extends BasePlugin {
  static get description() {
    return (
      'The <code>DiscordRcon</code> plugin allows a specified Discord channel to be used as a RCON console to ' +
      'run RCON commands.'
    );
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      discordClient: {
        required: true,
        description: 'Discord connector name.',
        connector: 'discord',
        default: 'discord'
      },
      channelID: {
        required: true,
        description: 'ID of channel to turn into RCON console.',
        default: '',
        example: '667741905228136459'
      },
      command: {
        required: false,
        description: 'Slash command used to run an RCON command.',
        default: 'rcon'
      },
      permissions: {
        required: false,
        description:
          '<ul>' +
          '<li>Dictionary of roles and a list of the permissions they are allowed to use.' +
          '<li>If dictionary is empty (<code>{}</code>) role checks are disabled and the command ' +
          'is restricted to Discord administrators instead.</li>' +
          '<li>A list of available RCON commands can be found here <a>https://squad.gamepedia.com/Server_Administration#Admin_Console_Commands</a>.' +
          '</ul>',
        default: {},
        example: {
          '123456789123456789': ['AdminBroadcast', 'AdminForceTeamChange', 'AdminDemoteCommander']
        }
      },
      prependAdminNameInBroadcast: {
        required: false,
        description: 'Prepend admin names when making announcements.',
        default: false
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.commandName = toCommandName(this.options.command);

    this.onCommandInteraction = this.onCommandInteraction.bind(this);
  }

  async mount() {
    const definition = {
      name: this.commandName,
      description: 'Run an RCON command on the Squad server.',
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'command',
          description: 'The RCON command to run.',
          required: true
        }
      ]
    };

    // Without a role whitelist the old plugin trusted anyone who could post in the RCON
    // channel. A slash command is reachable guild wide, so fall back to administrators
    // only rather than silently widening who can run RCON.
    if (Object.keys(this.options.permissions).length === 0)
      definition.default_member_permissions = '0';

    registerCommand(this.options.discordClient, definition, this.onCommandInteraction);
  }

  async unmount() {
    unregisterCommand(this.options.discordClient, this.commandName);
  }

  async onCommandInteraction(interaction) {
    // check that the channel is the RCON console channel
    if (interaction.channelId !== this.options.channelID) {
      await interaction.reply({
        content: 'RCON commands cannot be run in this channel.',
        ephemeral: true
      });
      return;
    }

    let command = interaction.options.getString('command');

    // write admin's name into broadcast command if prependAdminNameInBroadcast is enabled
    if (this.options.prependAdminNameInBroadcast)
      command = command.replace(
        /^AdminBroadcast /i,
        `AdminBroadcast ${interaction.member.displayName}: `
      );

    // check the admin has permissions
    if (Object.keys(this.options.permissions).length !== 0) {
      const commandPrefix = command.match(/([^ ]+)/);

      let hasPermission = false;
      for (const [role, allowedCommands] of Object.entries(this.options.permissions)) {
        if (!memberHasRole(interaction, role)) continue;

        for (const allowedCommand of allowedCommands)
          if (commandPrefix[1].toLowerCase() === allowedCommand.toLowerCase()) hasPermission = true;
      }

      if (!hasPermission) {
        await interaction.reply({
          content: 'You do not have permission to run that command.',
          ephemeral: true
        });
        return;
      }
    }

    // execute command and print response
    await interaction.deferReply();
    await this.respondToInteraction(interaction, await this.server.rcon.execute(command));
  }

  async respondToInteraction(interaction, response) {
    const splitResponses = this.splitLongResponse(response);

    for (const [index, splitResponse] of splitResponses.entries()) {
      const content = `\`\`\`${splitResponse}\`\`\``;

      if (index === 0) await interaction.editReply(content);
      else await interaction.followUp(content);
    }
  }

  splitLongResponse(response) {
    const responseMessages = [''];

    for (const line of response.split('\n')) {
      if (responseMessages[responseMessages.length - 1].length + line.length > 1994) {
        responseMessages.push(line);
      } else {
        responseMessages[responseMessages.length - 1] = `${
          responseMessages[responseMessages.length - 1]
        }\n${line}`;
      }
    }

    return responseMessages;
  }
}

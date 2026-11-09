import {
  ApplicationCommandOptionType,
  memberHasRole,
  registerCommand,
  toCommandName,
  unregisterCommand
} from '../utils/discord-commands.js';

import BasePlugin from './base-plugin.js';

export default class DiscordSubsystemRestarter extends BasePlugin {
  static get description() {
    return (
      'The <code>DiscordSubSystemRestarter</code> plugin allows you to manually restart SquadJS subsystems in case ' +
      'an issues arises with them.' +
      '<ul>' +
      '<li><code>/squadjs restartsubsystem system:rcon</code></li>' +
      '<li><code>/squadjs restartsubsystem system:logparser</code></li>' +
      '</ul>'
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
      command: {
        required: false,
        description: 'Slash command used to restart SquadJS subsystems.',
        default: 'squadjs'
      },
      role: {
        required: true,
        description: 'ID of role required to run the sub system restart commands.',
        default: '',
        example: '667741905228136459'
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
        description: 'Manage SquadJS subsystems.',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'restartsubsystem',
            description: 'Restart a SquadJS subsystem.',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'system',
                description: 'The subsystem to restart.',
                required: true,
                choices: [
                  { name: 'rcon', value: 'rcon' },
                  { name: 'logparser', value: 'logparser' }
                ]
              }
            ]
          }
        ]
      },
      this.onCommandInteraction
    );
  }

  async unmount() {
    unregisterCommand(this.options.discordClient, this.commandName);
  }

  async onCommandInteraction(interaction) {
    if (interaction.options.getSubcommand() !== 'restartsubsystem') return;

    if (!memberHasRole(interaction, this.options.role)) {
      await interaction.reply({
        content: 'You do not have permission to do that.',
        ephemeral: true
      });
      return;
    }

    const system = interaction.options.getString('system');

    await interaction.deferReply();

    if (system === 'rcon') {
      await this.server.restartRCON();
      await interaction.editReply('Restarted the SquadJS RCON subsystem.');
      return;
    }

    if (system === 'logparser') {
      await this.server.restartLogParser();
      await interaction.editReply('Restarted the SquadJS LogParser subsystem.');
    }
  }
}

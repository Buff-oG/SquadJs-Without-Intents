import Sequelize from 'sequelize';

import {
  ApplicationCommandOptionType,
  registerCommand,
  toCommandName,
  unregisterCommand
} from '../utils/discord-commands.js';

import BasePlugin from './base-plugin.js';

const { DataTypes } = Sequelize;

export default class DiscordBaseMessageUpdater extends BasePlugin {
  static get optionsSpecification() {
    return {
      discordClient: {
        required: true,
        description: 'Discord connector name.',
        connector: 'discord',
        default: 'discord'
      },
      messageStore: {
        required: true,
        description: 'Sequelize connector name.',
        connector: 'sequelize',
        default: 'sqlite'
      },
      command: {
        required: true,
        description:
          'Slash command name used to get the message. Any leading "!" is stripped, so ' +
          '<code>!command</code> and <code>command</code> both register <code>/command</code>.',
        default: '',
        example: 'command'
      },
      disableSubscriptions: {
        required: false,
        description: 'Whether to allow messages to be subscribed to automatic updates.',
        default: false
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    // Setup model to store subscribed messages.
    this.SubscribedMessage = this.options.messageStore.define(
      `${this.constructor.name}_SubscribedMessage`,
      { channelID: DataTypes.STRING, messageID: DataTypes.STRING, server: DataTypes.INTEGER },
      { timestamps: false }
    );

    this.commandName = toCommandName(this.options.command);

    this.onCommandInteraction = this.onCommandInteraction.bind(this);
  }

  async prepareToMount() {
    await this.SubscribedMessage.sync();
  }

  get commandDefinition() {
    const options = [
      {
        type: ApplicationCommandOptionType.String,
        name: 'action',
        description: 'Defaults to posting the message once.',
        required: false,
        choices: [
          { name: 'show', value: 'show' },
          { name: 'subscribe', value: 'subscribe' },
          { name: 'unsubscribe', value: 'unsubscribe' }
        ]
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'channel-id',
        description: 'Channel ID of the message to unsubscribe.',
        required: false
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'message-id',
        description: 'Message ID of the message to unsubscribe.',
        required: false
      }
    ];

    return {
      name: this.commandName,
      description: `Get the ${this.constructor.name} message.`,
      options
    };
  }

  async mount() {
    registerCommand(this.options.discordClient, this.commandDefinition, this.onCommandInteraction);
  }

  async unmount() {
    unregisterCommand(this.options.discordClient, this.commandName);
  }

  async generateMessage() {
    throw new Error('generateMessage method must be defined.');
  }

  async onCommandInteraction(interaction) {
    const action = interaction.options.getString('action') || 'show';

    // Handle non subscription messages.
    if (action === 'show') {
      // Generating the message can hit RCON, so buy time before Discord times out.
      await interaction.deferReply();

      this.verbose(1, 'Generating message content...');
      const generatedMessage = await this.generateMessage();

      this.verbose(1, 'Sending non-subscription message...');
      await interaction.editReply(generatedMessage);
      this.verbose(1, 'Sent non-subscription message.');

      return;
    }

    // Handle subscription message.
    if (action === 'subscribe') {
      if (this.options.disableSubscriptions) {
        await interaction.reply({
          content: 'Automated updates are disabled.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      this.verbose(1, 'Generating message content...');
      const generatedMessage = await this.generateMessage();

      // Send as a normal channel message rather than an interaction response so it stays
      // editable indefinitely, rather than expiring with the interaction token.
      this.verbose(1, 'Sending subscription message...');
      const newMessage = await interaction.channel.send(generatedMessage);
      this.verbose(1, 'Sent subscription message.');

      // Subscribe the message for automated updates.
      const newChannelID = newMessage.channel.id;
      const newMessageID = newMessage.id;

      this.verbose(
        1,
        `Subscribing message (Channel ID: ${newChannelID}, Message ID: ${newMessageID}) to automated updates...`
      );
      await this.SubscribedMessage.create({
        channelID: newChannelID,
        messageID: newMessageID,
        server: this.server.id
      });
      this.verbose(
        1,
        `Subscribed message (Channel ID: ${newChannelID}, Message ID: ${newMessageID}) to automated updates.`
      );

      await interaction.editReply('Subscribed message to automated updates.');

      return;
    }

    // Handle unsubscription messages.
    if (action === 'unsubscribe') {
      const channelID = interaction.options.getString('channel-id');
      const messageID = interaction.options.getString('message-id');

      if (!channelID || !messageID) {
        await interaction.reply({
          content: 'Unsubscribing requires both `channel-id` and `message-id`.',
          ephemeral: true
        });
        return;
      }

      this.verbose(
        1,
        `Unsubscribing message (Channel ID: ${channelID}, Message ID: ${messageID}) from automated updates...`
      );
      const removed = await this.SubscribedMessage.destroy({
        where: {
          channelID: channelID,
          messageID: messageID,
          server: this.server.id
        }
      });
      this.verbose(
        1,
        `Unsubscribed message (Channel ID: ${channelID}, Message ID: ${messageID}) from automated updates.`
      );

      this.verbose(1, 'Sending acknowledgement message...');
      await interaction.reply({
        content: removed
          ? 'Unsubscribed message from automated updates.'
          : 'No subscribed message found with that channel and message ID.',
        ephemeral: true
      });
      this.verbose(1, 'Sent acknowledgement message.');
    }
  }

  async updateMessages() {
    this.verbose(1, 'Generating message content for update...');
    // Generate the new message.
    const generatedMessage = await this.generateMessage();

    // Get subscribed messages.
    const subscribedMessages = await this.SubscribedMessage.findAll({
      where: { server: this.server.id }
    });

    // Update each message.
    this.verbose(1, `Updating ${subscribedMessages.length} messages...`);
    for (const subscribedMessage of subscribedMessages) {
      const { channelID, messageID } = subscribedMessage;

      try {
        this.verbose(1, `Getting message (Channel ID: ${channelID}, Message ID: ${messageID})...`);
        const channel = await this.options.discordClient.channels.fetch(channelID);
        const message = await channel.messages.fetch(messageID);

        this.verbose(1, `Updating message (Channel ID: ${channelID}, Message ID: ${messageID})...`);
        await message.edit(generatedMessage);
        this.verbose(1, `Updated message (Channel ID: ${channelID}, Message ID: ${messageID}).`);
      } catch (err) {
        if (err.code === 10008) {
          this.verbose(
            1,
            `Message (Channel ID: ${channelID}, Message ID: ${messageID}) was deleted. Removing from automated updates...`
          );
          await subscribedMessage.destroy();
        } else {
          this.verbose(
            1,
            `Message (Channel ID: ${channelID}, Message ID: ${messageID}) could not be updated: `,
            err
          );
        }
      }
    }
  }
}

import { ApplicationCommandOptionType, Events, REST, Routes } from 'discord.js';

import Logger from 'core/logger';

/**
 * Shared slash command registry for plugins using the same Discord client.
 *
 * SquadJS runs without privileged gateway intents. All user input arrives through
 * slash command interactions, whose options are never gated by MESSAGE_CONTENT, so
 * the client only ever needs the non-privileged Guilds intent.
 *
 * Plugins register during mount(). Because plugins mount in parallel, definitions are
 * collected and pushed to Discord in a single debounced bulk overwrite.
 */

const registries = new WeakMap();

/**
 * SquadJS configs have historically used chat style prefixes such as "!status".
 * Discord requires lowercase names with no punctuation, so normalise them.
 */
export function toCommandName(command) {
  return String(command)
    .replace(/^[!/.]+/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 32);
}

/** Read a role off an interaction member without needing the GuildMembers intent. */
export function memberHasRole(interaction, roleID) {
  const member = interaction.member;
  if (!member || !roleID) return false;

  // GuildMember when the guild is cached, raw API member object otherwise.
  if (member.roles && member.roles.cache) return member.roles.cache.has(roleID);
  return Array.isArray(member.roles) ? member.roles.includes(roleID) : false;
}

class CommandRegistry {
  constructor(client) {
    this.client = client;
    this.definitions = new Map();
    this.handlers = new Map();
    this.syncTimeout = null;

    this.onInteraction = this.onInteraction.bind(this);
    this.onGuildCreate = this.onGuildCreate.bind(this);

    this.client.on(Events.InteractionCreate, this.onInteraction);
    this.client.on(Events.GuildCreate, this.onGuildCreate);
  }

  add(definition, handler) {
    this.definitions.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
    this.scheduleSync();
  }

  remove(name) {
    this.definitions.delete(name);
    this.handlers.delete(name);
    this.scheduleSync();
  }

  async onInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const handler = this.handlers.get(interaction.commandName);
    if (!handler) return;

    try {
      await handler(interaction);
    } catch (err) {
      Logger.verbose('DiscordCommands', 1, `Error running /${interaction.commandName}: `, err);

      // Never leave the interaction hanging, or Discord shows "application did not respond".
      try {
        const response = { content: 'An error occurred while running that command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.followUp(response);
        else await interaction.reply(response);
      } catch (replyErr) {
        Logger.verbose('DiscordCommands', 1, 'Could not report command error: ', replyErr);
      }
    }
  }

  async onGuildCreate(guild) {
    await this.syncGuild(guild.id);
  }

  scheduleSync() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);

    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      this.sync().catch((err) =>
        Logger.verbose('DiscordCommands', 1, 'Failed to sync slash commands: ', err)
      );
    }, 1000);
  }

  async sync() {
    if (!this.client.isReady())
      await new Promise((resolve) => this.client.once(Events.ClientReady, resolve));

    const guildIDs = [...this.client.guilds.cache.keys()];

    if (guildIDs.length === 0) {
      Logger.verbose('DiscordCommands', 1, 'Bot is in no guilds, skipping slash command sync.');
      return;
    }

    for (const guildID of guildIDs) await this.syncGuild(guildID);
  }

  async syncGuild(guildID) {
    const body = [...this.definitions.values()];
    if (body.length === 0) return;

    // Guild scoped commands appear instantly; global commands can take up to an hour.
    const rest = new REST().setToken(this.client.token);

    try {
      await rest.put(Routes.applicationGuildCommands(this.client.user.id, guildID), { body });
      Logger.verbose(
        'DiscordCommands',
        1,
        `Synced ${body.length} slash command(s) to guild ${guildID}.`
      );
    } catch (err) {
      Logger.verbose('DiscordCommands', 1, `Failed to sync commands to guild ${guildID}: `, err);
    }
  }
}

function getRegistry(client) {
  if (!registries.has(client)) registries.set(client, new CommandRegistry(client));
  return registries.get(client);
}

export function registerCommand(client, definition, handler) {
  getRegistry(client).add(definition, handler);
}

export function unregisterCommand(client, name) {
  if (registries.has(client)) registries.get(client).remove(name);
}

export { ApplicationCommandOptionType };

import Sequelize from 'sequelize';

import DiscordBasePlugin from './discord-base-plugin.js';

const { DataTypes } = Sequelize;

export default class DiscordDeployableSpawns extends DiscordBasePlugin {
  static get description() {
    return (
      'The <code>DiscordDeployableSpawns</code> plugin records deployables spawned by players to ' +
      'the database and, when a <code>channelID</code> is set, also posts them to a Discord ' +
      'channel. Deployables are high volume, so use <code>deployableTypes</code> to restrict ' +
      'which ones are posted to Discord.'
    );
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBasePlugin.optionsSpecification,
      database: {
        required: true,
        connector: 'sequelize',
        description: 'The Sequelize connector to record deployable spawns to.',
        default: 'mysql'
      },
      channelID: {
        required: false,
        description:
          'Channel to post deployable spawns to. Leave empty to record to the database only.',
        default: ''
      },
      deployableTypes: {
        required: false,
        description:
          'Only post deployables whose name contains one of these strings to Discord. Leave ' +
          'empty to post every deployable, which will very likely hit Discord rate limits. Does ' +
          'not affect what is recorded to the database.',
        default: [],
        example: ['FOBRadio', 'Hab']
      },
      color: {
        required: false,
        description: 'The color of the embed.',
        default: 16761867
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.DeployableSpawn = this.options.database.define(
      'DeployableSpawn',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        server: { type: DataTypes.INTEGER },
        time: { type: DataTypes.DATE },
        layer: { type: DataTypes.STRING },
        deployable: { type: DataTypes.STRING },
        team: { type: DataTypes.INTEGER },
        playerName: { type: DataTypes.STRING },
        steamID: { type: DataTypes.STRING },
        eosID: { type: DataTypes.STRING },
        locationX: { type: DataTypes.FLOAT },
        locationY: { type: DataTypes.FLOAT },
        locationZ: { type: DataTypes.FLOAT }
      },
      { timestamps: false }
    );

    this.onDeployableSpawned = this.onDeployableSpawned.bind(this);
  }

  async prepareToMount() {
    // Only resolve a Discord channel when one is actually configured.
    if (this.options.channelID) await super.prepareToMount();

    await this.DeployableSpawn.sync();
  }

  async mount() {
    this.server.on('DEPLOYABLE_SPAWNED', this.onDeployableSpawned);
  }

  async unmount() {
    this.server.off('DEPLOYABLE_SPAWNED', this.onDeployableSpawned);
  }

  async onDeployableSpawned(info) {
    const deployable = `${info.deployable}`;
    const playerName = info.player ? info.player.name : info.name;

    try {
      await this.DeployableSpawn.create({
        server: this.server.id,
        time: info.time,
        layer: this.server.currentLayer ? this.server.currentLayer.name : null,
        deployable,
        team: info.team,
        playerName,
        steamID: info.player ? info.player.steamID : info.steamID,
        eosID: info.player ? info.player.eosID : info.eosID,
        locationX: info.locationX,
        locationY: info.locationY,
        locationZ: info.locationZ
      });
    } catch (error) {
      this.verbose(1, `Could not record deployable spawn: ${error.message}`);
    }

    if (!this.channel) return;

    const allowed = this.options.deployableTypes;
    if (
      allowed.length > 0 &&
      !allowed.some((type) => deployable.toLowerCase().includes(type.toLowerCase()))
    )
      return;

    const location = [info.locationX, info.locationY, info.locationZ]
      .filter((value) => value !== null && value !== undefined)
      .join(', ');

    await this.sendDiscordMessage({
      embed: {
        title: 'Deployable Spawned',
        color: this.options.color,
        fields: [
          { name: 'Deployable', value: deployable, inline: true },
          { name: 'Team', value: `${info.team}`, inline: true },
          { name: 'Player', value: `${playerName}`, inline: true },
          { name: 'Location', value: location || info.locationRaw || 'Unknown' }
        ],
        timestamp: info.time.toISOString()
      }
    });
  }
}

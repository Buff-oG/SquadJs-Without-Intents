import Sequelize from 'sequelize';

import DiscordBasePlugin from './discord-base-plugin.js';

const { DataTypes } = Sequelize;

export default class DiscordMapMarkers extends DiscordBasePlugin {
  static get description() {
    return (
      'The <code>DiscordMapMarkers</code> plugin records map markers placed by players to the ' +
      'database and, when a <code>channelID</code> is set, also posts them to a Discord channel. ' +
      'Markers are high volume, so use <code>markerTypes</code> to restrict which ones are ' +
      'posted to Discord or rate limits will cause the bot to fall behind.'
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
        description: 'The Sequelize connector to record map markers to.',
        default: 'mysql'
      },
      channelID: {
        required: false,
        description:
          'Channel to post map markers to. Leave empty to record to the database only.',
        default: ''
      },
      markerTypes: {
        required: false,
        description:
          'Only post markers of these types to Discord. Leave empty to post every marker, which ' +
          'will very likely hit Discord rate limits on a busy server. Does not affect what is ' +
          'recorded to the database.',
        default: [],
        example: ['Attack', 'Defend']
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

    this.MapMarker = this.options.database.define(
      'MapMarker',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        server: { type: DataTypes.INTEGER },
        time: { type: DataTypes.DATE },
        layer: { type: DataTypes.STRING },
        playerName: { type: DataTypes.STRING },
        steamID: { type: DataTypes.STRING },
        eosID: { type: DataTypes.STRING },
        team: { type: DataTypes.INTEGER },
        markerTeam: { type: DataTypes.INTEGER },
        markerType: { type: DataTypes.STRING },
        locationX: { type: DataTypes.FLOAT },
        locationY: { type: DataTypes.FLOAT },
        locationZ: { type: DataTypes.FLOAT }
      },
      { timestamps: false }
    );

    this.onMapMarkerPlaced = this.onMapMarkerPlaced.bind(this);
  }

  async prepareToMount() {
    // Only resolve a Discord channel when one is actually configured.
    if (this.options.channelID) await super.prepareToMount();

    await this.MapMarker.sync();
  }

  async mount() {
    this.server.on('MAP_MARKER_PLACED', this.onMapMarkerPlaced);
  }

  async unmount() {
    this.server.off('MAP_MARKER_PLACED', this.onMapMarkerPlaced);
  }

  async onMapMarkerPlaced(info) {
    const markerType = `${info.markerType}`;
    const playerName = info.player ? info.player.name : info.name;

    try {
      await this.MapMarker.create({
        server: this.server.id,
        time: info.time,
        layer: this.server.currentLayer ? this.server.currentLayer.name : null,
        playerName,
        steamID: info.player ? info.player.steamID : info.steamID,
        eosID: info.player ? info.player.eosID : info.eosID,
        team: info.team,
        markerTeam: info.markerTeam,
        markerType,
        locationX: info.locationX,
        locationY: info.locationY,
        locationZ: info.locationZ
      });
    } catch (error) {
      this.verbose(1, `Could not record map marker: ${error.message}`);
    }

    if (!this.channel) return;

    const allowed = this.options.markerTypes;
    if (allowed.length > 0 && !allowed.some((t) => t.toLowerCase() === markerType.toLowerCase()))
      return;

    const location = [info.locationX, info.locationY, info.locationZ]
      .filter((value) => value !== null && value !== undefined)
      .join(', ');

    await this.sendDiscordMessage({
      embed: {
        title: 'Map Marker Placed',
        color: this.options.color,
        fields: [
          { name: 'Player', value: `${playerName}`, inline: true },
          { name: 'Team', value: `${info.team}`, inline: true },
          { name: 'Type', value: markerType, inline: true },
          { name: 'Location', value: location || info.locationRaw || 'Unknown' }
        ],
        timestamp: info.time.toISOString()
      }
    });
  }
}

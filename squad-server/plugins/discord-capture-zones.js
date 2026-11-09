import Sequelize from 'sequelize';

import DiscordBasePlugin from './discord-base-plugin.js';

const { DataTypes } = Sequelize;

export default class DiscordCaptureZones extends DiscordBasePlugin {
  static get description() {
    return (
      'The <code>DiscordCaptureZones</code> plugin records capture zone ownership changes to the ' +
      'database and, when a <code>channelID</code> is set, also posts them to a Discord channel.'
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
        description: 'The Sequelize connector to record capture zone changes to.',
        default: 'mysql'
      },
      channelID: {
        required: false,
        description:
          'Channel to post capture zone changes to. Leave empty to record to the database only.',
        default: ''
      },
      showCaptured: {
        required: false,
        description: 'Whether to record when a zone is fully captured.',
        default: true
      },
      showNeutralized: {
        required: false,
        description: 'Whether to record when a zone is neutralised.',
        default: true
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

    this.CaptureZone = this.options.database.define(
      'CaptureZone',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        server: { type: DataTypes.INTEGER },
        time: { type: DataTypes.DATE },
        layer: { type: DataTypes.STRING },
        zone: { type: DataTypes.STRING },
        action: { type: DataTypes.STRING },
        team: { type: DataTypes.INTEGER },
        previousTeam: { type: DataTypes.INTEGER }
      },
      { timestamps: false }
    );

    this.onCaptureZone = this.onCaptureZone.bind(this);
  }

  async prepareToMount() {
    // Only resolve a Discord channel when one is actually configured.
    if (this.options.channelID) await super.prepareToMount();

    await this.CaptureZone.sync();
  }

  async mount() {
    if (this.options.showCaptured) this.server.on('CAPTURE_ZONE_CAPTURED', this.onCaptureZone);
    if (this.options.showNeutralized)
      this.server.on('CAPTURE_ZONE_NEUTRALIZED', this.onCaptureZone);
  }

  async unmount() {
    this.server.off('CAPTURE_ZONE_CAPTURED', this.onCaptureZone);
    this.server.off('CAPTURE_ZONE_NEUTRALIZED', this.onCaptureZone);
  }

  async onCaptureZone(info) {
    // A database failure must not stop the Discord message, or vice versa.
    try {
      await this.CaptureZone.create({
        server: this.server.id,
        time: info.time,
        layer: this.server.currentLayer ? this.server.currentLayer.name : null,
        zone: info.zone,
        action: info.action,
        team: info.team,
        previousTeam: info.previousTeam
      });
    } catch (error) {
      this.verbose(1, `Could not record capture zone change: ${error.message}`);
    }

    if (!this.channel) return;

    const fields = [
      { name: 'Zone', value: `${info.zone}`, inline: true },
      { name: 'Team', value: `${info.team}`, inline: true }
    ];

    if (info.previousTeam)
      fields.push({ name: 'Previously Held By', value: `Team ${info.previousTeam}`, inline: true });

    await this.sendDiscordMessage({
      embed: {
        title: info.action === 'captured' ? 'Capture Zone Taken' : 'Capture Zone Neutralised',
        color: this.options.color,
        fields,
        timestamp: info.time.toISOString()
      }
    });
  }
}

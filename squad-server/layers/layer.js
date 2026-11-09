export default class Layer {
  constructor(data) {
    const teamConfigs = data.teamConfigs || {};
    const factions = Array.isArray(data.factions) ? data.factions : [];
    const objectives = data.objectives || {};
 
    this.name = data.Name;
    this.classname = data.levelName;
    this.layerid = data.rawName;
    this.map = {
      name: data.mapName
    };
    this.gamemode = data.gamemode;
    // This feed has no separate `type` field; gamemode is the only classifier.
    this.gamemodeType = data.gamemode;
    // layerVersion is missing on some entries (e.g. GLOPS, TDM layers).
    this.version = data.layerVersion || null;
    this.size = data.mapSize;
    this.sizeType = null;
    this.biome = data.biome || null;
 
    // No `capturePoints` field. Derive it from distinct objective positions,
    // excluding the two mains (0 and 100). Layers with `objectives: {}` give 0.
    this.numberOfCapturePoints = new Set(
      Object.values(objectives)
        .map((o) => o.pointPosition)
        .filter((p) => typeof p === 'number' && p !== 0 && p !== 100)
    ).size;
 
    this.lighting = {
      name: data.persistentLightingType || 'Unknown',
      classname: data.lightingLevel || ''
    };
 
    this.teams = [];
    for (const t of ['team1', 'team2']) {
      const cfg = teamConfigs[t] || {};
      const teamIndex = cfg.index != null ? cfg.index : t === 'team1' ? 1 : 2;
 
      // Factions this team may actually pick, per availableOnTeams.
      const available = factions
        .filter((f) => Array.isArray(f.availableOnTeams) && f.availableOnTeams.includes(teamIndex))
        .map((f) => f.factionId);
 
      const unit = cfg.defaultFactionUnit || '';
 
      this.teams.push({
        // defaultFactionUnit looks like "GARP1_AirAssault_Bespin" -> "GARP1".
        // Imperfect for compound IDs like GARUNCP2 ("GARUNC_P2_Mechanized").
        faction: unit ? unit.split('_')[0] : null,
        name: unit || null,
        unit: unit || null,
        tickets: cfg.tickets != null ? cfg.tickets : 0,
        playerPercent: cfg.playerPercent != null ? cfg.playerPercent : 50,
        // commander is a top-level layer property here, not per-team.
        commander: data.commander === true,
        availableFactions: [...new Set(available)],
        // The scrape contains no vehicle data. These exist only so downstream
        // plugins that read them don't throw.
        vehicles: [],
        numberOfTanks: 0,
        numberOfHelicopters: 0
      });
    }
  }
}
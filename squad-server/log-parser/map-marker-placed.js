import parseLocation from '../utils/parse-location.js';

/**
 * Matches when a player places a map marker.
 *
 * The log line carries a single ID which may be either a SteamID64 or an EOS ID, so it
 * is classified by shape: SteamID64 is 17 digits, EOS IDs are hexadecimal.
 */
export default {
  regex:
    /^\[([0-9.:-]+)]\[([ 0-9]*)]Log[A-Za-z]+: (?:Display: )?Player (.+?) \(Team: ([0-9]+); ID: ([^)]+?)\) placed a new map marker for team ([0-9]+)\s*:\s*Type:\s*(.+?)\s*;\s*Location:\s*(.+?)\s*$/,
  onMatch: (args, logParser) => {
    const rawID = args[5].trim();
    const IDs = /^[0-9]{17}$/.test(rawID) ? { steamID: rawID } : { eosID: rawID };

    const data = {
      raw: args[0],
      time: args[1],
      chainID: +args[2],
      name: args[3],
      team: args[4],
      ...IDs,
      markerTeam: args[6],
      markerType: args[7],
      ...parseLocation(args[8])
    };

    logParser.emit('MAP_MARKER_PLACED', data);
  }
};

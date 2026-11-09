import { iterateIDs, lowerID } from 'core/id-parser';

import parseLocation from '../utils/parse-location.js';

/**
 * Matches when a deployable (FOB, HAB, sandbag, ammo bag, mine, ...) is spawned.
 *
 * Capture groups: 3 deployable, 4 team, 5 location, 6 player name, 7 in game player ID,
 * 8 the "OnlineIDs:" body which may hold both a SteamID and an EOS ID.
 */
export default {
  regex:
    /^\[([0-9.:-]+)]\[([ 0-9]*)]Log[A-Za-z]+: (?:Display: )?Deployable (.+?) spawned for team ([0-9]+) at location \{(.+?)\} by player (.+?) \(ID:\s*([^,]+?),\s*OnlineIDs:\s*([^)]+?)\s*\)/,
  onMatch: (args, logParser) => {
    const IDs = {};
    iterateIDs(args[8]).forEach((platform, id) => {
      IDs[lowerID(platform)] = id;
    });

    const data = {
      raw: args[0],
      time: args[1],
      chainID: +args[2],
      deployable: args[3],
      team: args[4],
      ...parseLocation(args[5]),
      name: args[6],
      playerID: args[7],
      ...IDs
    };

    logParser.emit('DEPLOYABLE_SPAWNED', data);
  }
};

/**
 * Matches when a capture zone is fully captured by a team.
 *
 * Offworld documents the message body but not the log category, so the category is
 * matched loosely rather than pinned to a specific Log* namespace.
 */
export default {
  regex:
    /^\[([0-9.:-]+)]\[([ 0-9]*)]Log[A-Za-z]+: (?:Display: )?Capture zone (.+?) was fully captured by team ([0-9]+)/,
  onMatch: (args, logParser) => {
    const data = {
      raw: args[0],
      time: args[1],
      chainID: +args[2],
      zone: args[3],
      team: args[4],
      previousTeam: null,
      action: 'captured'
    };

    logParser.emit('CAPTURE_ZONE_CAPTURED', data);
  }
};

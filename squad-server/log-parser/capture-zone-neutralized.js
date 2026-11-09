/**
 * Matches when a capture zone is neutralised, including the team that previously held it.
 *
 * Both spellings are accepted because Squad's logs are not consistent about it.
 */
export default {
  regex:
    /^\[([0-9.:-]+)]\[([ 0-9]*)]Log[A-Za-z]+: (?:Display: )?Capture zone (.+?) was neutrali[sz]ed by team ([0-9]+) \(was owned by team ([0-9]+)\)/,
  onMatch: (args, logParser) => {
    const data = {
      raw: args[0],
      time: args[1],
      chainID: +args[2],
      zone: args[3],
      team: args[4],
      previousTeam: args[5],
      action: 'neutralized'
    };

    logParser.emit('CAPTURE_ZONE_NEUTRALIZED', data);
  }
};

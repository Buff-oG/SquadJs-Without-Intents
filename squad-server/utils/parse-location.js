/**
 * Parse a location string from the Squad logs into numeric coordinates.
 *
 * Handles both the labelled form ("X=1234.5 Y=-678.9 Z=10.1") and a bare
 * delimited triple ("1234.5,-678.9,10.1"), since the exact shape varies by event.
 * The original string is kept so nothing is lost if the format changes again.
 */
export default function parseLocation(raw) {
  if (!raw) return { locationX: null, locationY: null, locationZ: null, locationRaw: null };

  const labelled = {};
  for (const match of raw.matchAll(/([XYZ])\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)/gi))
    labelled[match[1].toUpperCase()] = parseFloat(match[2]);

  if (Object.keys(labelled).length > 0)
    return {
      locationX: labelled.X ?? null,
      locationY: labelled.Y ?? null,
      locationZ: labelled.Z ?? null,
      locationRaw: raw
    };

  const numbers = (raw.match(/-?[0-9]+(?:\.[0-9]+)?/g) || []).map(Number);

  return {
    locationX: numbers[0] ?? null,
    locationY: numbers[1] ?? null,
    locationZ: numbers[2] ?? null,
    locationRaw: raw
  };
}

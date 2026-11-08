export type LonLat = { lon: number; lat: number };

const EARTH_M = 6371008.8;

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const haversineMeters = (a: LonLat, b: LonLat): number => {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lon - a.lon) * Math.PI) / 180;
  const sine =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(sine)));
};

/** Initial bearing in degrees, north 0, clockwise. Not a compass reading. */
export const initialBearingDegrees = (from: LonLat, to: LonLat): number => {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const dLambda = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

export const normalizeBearing = (degrees: number): number =>
  ((degrees % 360) + 360) % 360;

const CARDINALS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] as const;

export const cardinalFromBearing = (degrees: number): string => {
  const index = Math.round(normalizeBearing(degrees) / 45) % 8;
  return CARDINALS[index];
};

/**
 * Meters from a point to the straight segment between two stored points.
 * Uses a local tangent plane, which is accurate for short via-ferrata segments.
 */
export const distanceToSegmentMeters = (
  point: LonLat,
  start: LonLat,
  end: LonLat,
): number => {
  const meanLat = ((start.lat + end.lat) / 2) * (Math.PI / 180);
  const metersPerDegLat = 111132.92;
  const metersPerDegLon = 111412.84 * Math.cos(meanLat);
  const bx = (end.lon - start.lon) * metersPerDegLon;
  const by = (end.lat - start.lat) * metersPerDegLat;
  const px = (point.lon - start.lon) * metersPerDegLon;
  const py = (point.lat - start.lat) * metersPerDegLat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  const t = Math.min(1, Math.max(0, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
};

export const distanceToTrackMeters = (
  point: LonLat,
  track: LonLat[],
): number | null => {
  if (track.length === 0) return null;
  if (track.length === 1) return haversineMeters(point, track[0]);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < track.length; index += 1) {
    const distance = distanceToSegmentMeters(
      point,
      track[index - 1],
      track[index],
    );
    if (distance < best) best = distance;
  }
  return best;
};

export const nearestStoredPoint = <T extends LonLat>(
  point: LonLat,
  track: T[],
): T | null => {
  if (track.length === 0) return null;
  return track.reduce((best, candidate) =>
    haversineMeters(point, candidate) < haversineMeters(point, best)
      ? candidate
      : best,
  );
};

export const formatMeters = (meters: number): string => {
  if (!Number.isFinite(meters) || meters < 0) return '–';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

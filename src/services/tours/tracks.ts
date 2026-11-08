import { parseGpx } from '../kletterglueck/gpx';

export type TrackPoint = [longitude: number, latitude: number];
export type Track = TrackPoint[][];

export const MAX_TRACK_POINTS = 5000;

export const isTrack = (value: unknown): value is Track => {
  if (!Array.isArray(value) || value.length === 0) return false;
  let count = 0;
  for (const segment of value) {
    if (!Array.isArray(segment) || segment.length < 2) return false;
    count += segment.length;
    if (count > MAX_TRACK_POINTS) return false;
    for (const point of segment) {
      if (!Array.isArray(point) || point.length !== 2) return false;
      const [lon, lat] = point;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
      if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return false;
    }
  }
  return true;
};

/** Same reader as the personal GPX import; the central catalog keeps 5,000 points. */
export const parseTourGpx = (xml: string): Track => {
  const parsed = parseGpx(xml);
  // The shared catalog takes no partially broken files.
  if (
    parsed.skippedPoints ||
    parsed.skippedSegments ||
    !isTrack(parsed.segments)
  ) {
    throw new Error(
      'Ungültige Koordinaten, zu kurze Segmente oder mehr als 5.000 Punkte.',
    );
  }
  return parsed.segments;
};

export type Tour = {
  id: string;
  name: string;
  difficulty: string | null;
  duration_minutes: number | null;
  osm_ref: string | null;
  source: string;
  attribution: string | null;
  track: Track;
  length_m: number;
};

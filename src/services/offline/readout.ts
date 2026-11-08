import {
  cardinalFromBearing,
  distanceToTrackMeters,
  formatMeters,
  haversineMeters,
  initialBearingDegrees,
  isFiniteNumber,
  nearestStoredPoint,
  normalizeBearing,
} from './geo';
import { TrackPoint, TourPack } from './types';

export type FixLike = { lat: number; lon: number; altitude: number | null };

export type FieldReadout = {
  distanceTrack: string | null;
  distanceStart: string | null;
  distanceEnd: string | null;
  bearingToNearest: string | null;
  nearestElevation: string | null;
};

const bearingLabel = (from: FixLike, to: TrackPoint): string => {
  const degrees = normalizeBearing(initialBearingDegrees(from, to));
  return `${Math.round(degrees)}° ${cardinalFromBearing(degrees)}`;
};

/** Distances and direction from real points only. Missing inputs stay null. */
export const fieldReadout = (
  pack: TourPack,
  track: TrackPoint[] | null,
  fix: FixLike | null,
): FieldReadout => {
  if (!fix || !track || track.length === 0) {
    return {
      distanceTrack: null,
      distanceStart: null,
      distanceEnd: null,
      bearingToNearest: null,
      nearestElevation: null,
    };
  }
  const start = track[0];
  const end = track[track.length - 1];
  const along =
    track.length >= 2
      ? distanceToTrackMeters(fix, track)
      : haversineMeters(fix, start);
  const nearest = nearestStoredPoint(fix, track);
  const elevation =
    nearest && isFiniteNumber(nearest.ele)
      ? `${Math.round(nearest.ele)} m`
      : null;
  const nearestDistance = nearest ? haversineMeters(fix, nearest) : null;
  return {
    distanceTrack: along == null ? null : formatMeters(along),
    distanceStart: formatMeters(haversineMeters(fix, start)),
    distanceEnd: formatMeters(haversineMeters(fix, end)),
    bearingToNearest:
      nearest && nearestDistance != null && nearestDistance >= 1
        ? bearingLabel(fix, nearest)
        : null,
    nearestElevation: elevation,
  };
};

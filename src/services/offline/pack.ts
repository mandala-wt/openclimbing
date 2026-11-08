import { isFiniteNumber } from './geo';
import { jsonUtf8Bytes } from './limits';
import {
  MAP_TILES_NOTE,
  OSM_ATTRIBUTION,
  StoredTrack,
  TagPair,
  TourPack,
} from './types';

export type PackSource = {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  tags?: Record<string, string | undefined> | null;
  lon?: number | null;
  lat?: number | null;
  osmTimestamp?: string | null;
  tracks?: StoredTrack[];
  savedAt: string;
};

const DIFFICULTY_EXACT = new Set([
  'via_ferrata_scale',
  'sac_scale',
  'difficulty',
]);

export const isDifficultyKey = (key: string): boolean =>
  DIFFICULTY_EXACT.has(key) ||
  key.startsWith('via_ferrata_scale:') ||
  key.startsWith('climbing:grade');

export const isDescriptionKey = (key: string): boolean =>
  key === 'description' || key.startsWith('description:');

const pairs = (
  tags: Record<string, string | undefined> | null | undefined,
  accept: (key: string) => boolean,
): TagPair[] =>
  Object.entries(tags ?? {})
    .filter(
      (entry): entry is [string, string] =>
        accept(entry[0]) && typeof entry[1] === 'string' && entry[1].length > 0,
    )
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));

const pickName = (
  tags: Record<string, string | undefined> | null | undefined,
  id: string,
): { name: string; nameFromOsm: boolean } => {
  const name = tags?.name || tags?.['name:de'] || tags?.['name:en'];
  if (typeof name === 'string' && name.length > 0) {
    return { name, nameFromOsm: true };
  }
  return { name: id, nameFromOsm: false };
};

export const withByteSize = (pack: Omit<TourPack, 'bytes'>): TourPack => {
  const bytes = jsonUtf8Bytes({ ...pack, bytes: 0 });
  return { ...pack, bytes };
};

export const buildTourPack = (source: PackSource): TourPack => {
  const id = `${source.osmType}/${source.osmId}`;
  const { name, nameFromOsm } = pickName(source.tags, id);
  const hasLocation = isFiniteNumber(source.lon) && isFiniteNumber(source.lat);
  const tracks = (source.tracks ?? []).filter(
    (track) => track.points.length >= 2,
  );
  return withByteSize({
    id,
    osmType: source.osmType,
    osmId: source.osmId,
    name,
    nameFromOsm,
    lon: hasLocation ? source.lon! : null,
    lat: hasLocation ? source.lat! : null,
    locationSource: hasLocation
      ? 'Lage aus dem geladenen OpenStreetMap-Objekt'
      : null,
    difficulty: pairs(source.tags, isDifficultyKey),
    description: pairs(source.tags, isDescriptionKey),
    osmTimestamp: source.osmTimestamp ?? null,
    savedAt: source.savedAt,
    tracks,
    mapTilesIncluded: false,
    mapTilesNote: MAP_TILES_NOTE,
    attribution: OSM_ATTRIBUTION,
  });
};

export const tourIdOf = (
  osmType: string | undefined,
  osmId: number | undefined,
): string | null => {
  if (
    (osmType === 'node' || osmType === 'way' || osmType === 'relation') &&
    isFiniteNumber(osmId)
  ) {
    return `${osmType}/${osmId}`;
  }
  return null;
};

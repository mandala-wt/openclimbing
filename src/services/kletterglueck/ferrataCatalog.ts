import type { ClimbingArea } from '../climbing-areas/getClimbingAreas';
import { CLIMBING_TILES_HOST } from '../osm/consts';
import { fetchJson } from '../fetch';

const CATALOG_TTL_MS = 60 * 60 * 1000;

export const FERRATA_CATALOG_URL = `${CLIMBING_TILES_HOST}api/climbing-tiles/areas?type=ferrata`;

type Loaded = { at: number; catalog: ClimbingArea[]; index: CatalogIndex };

export type CatalogIndex = {
  byMapId: Map<number, ClimbingArea>;
  byShortId: Map<string, ClimbingArea>;
};

let loaded: Loaded | null = null;
let running: Promise<Loaded> | null = null;

const MAP_TYPE_DIGIT = { node: 0, way: 1, relation: 4 } as const;

/** Same as convertOsmIdToMapId in components/Map/helpers. */
export const mapIdOfArea = (area: Pick<ClimbingArea, 'osmType' | 'osmId'>) =>
  Number(`${area.osmId}${MAP_TYPE_DIGIT[area.osmType]}`);

const buildIndex = (catalog: ClimbingArea[]): CatalogIndex => {
  const byMapId = new Map<number, ClimbingArea>();
  const byShortId = new Map<string, ClimbingArea>();
  for (const area of catalog) {
    byMapId.set(mapIdOfArea(area), area);
    byShortId.set(`${area.osmType[0]}${area.osmId}`, area);
  }
  return { byMapId, byShortId };
};

const isCatalog = (value: unknown): value is ClimbingArea[] =>
  Array.isArray(value) &&
  value.every(
    (row) =>
      row &&
      typeof row === 'object' &&
      ['node', 'way', 'relation'].includes(row.osmType) &&
      Number.isFinite(row.osmId) &&
      Number.isFinite(row.lon) &&
      Number.isFinite(row.lat),
  );

/**
 * One catalog for the map filter, the search list and the tour details.
 * Loaded once per hour; concurrent callers share the same request. Errors are
 * thrown so the UI can tell "failed" from "empty".
 */
export const loadFerrataCatalog = async (): Promise<Loaded> => {
  if (loaded && Date.now() - loaded.at < CATALOG_TTL_MS) return loaded;
  if (running) return running;
  running = (async () => {
    try {
      const data = await fetchJson<unknown>(FERRATA_CATALOG_URL);
      if (!isCatalog(data)) {
        throw new Error(
          'Der Klettersteig-Katalog hat ein unerwartetes Format.',
        );
      }
      loaded = { at: Date.now(), catalog: data, index: buildIndex(data) };
      return loaded;
    } finally {
      running = null;
    }
  })();
  return running;
};

/** For callers that prefer an empty list over an error (map filter). */
export const loadFerrataCatalogOrEmpty = async () => {
  try {
    return await loadFerrataCatalog();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Klettersteig-Katalog nicht geladen', error);
    return null;
  }
};

export const resetFerrataCatalogForTests = () => {
  loaded = null;
  running = null;
};

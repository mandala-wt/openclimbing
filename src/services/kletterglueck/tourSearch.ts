import type { ClimbingArea } from '../climbing-areas/getClimbingAreas';
import {
  ALL_FERRATA_GRADES,
  FerrataGrade,
  matchesFerrataGrade,
} from '../tagging/ferrataGradeFilter';
import {
  FerrataMeasure,
  getFerrataMeasure,
  matchesFerrataMeasures,
} from '../tagging/ferrataMeasures';
import { getCountryName } from '../getCountryFlag';

export type Interval = [number, number];

/** Favourites and visited ferratas are stored locally (see MyListsContext). */
export type PersonalFilter = 'all' | 'favorites' | 'visited' | 'notVisited';

export const PERSONAL_FILTERS: PersonalFilter[] = [
  'all',
  'favorites',
  'visited',
  'notVisited',
];

export type PersonalSets = {
  favorites: ReadonlySet<string>;
  visited: ReadonlySet<string>;
};

export const EMPTY_PERSONAL_SETS: PersonalSets = {
  favorites: new Set(),
  visited: new Set(),
};

export type TourFilter = {
  ferrataGrades: readonly FerrataGrade[];
  ferrataCountries: readonly string[];
  lengthInterval: Interval;
  spanInterval: Interval;
  eleInterval: Interval;
  isLengthDefault: boolean;
  isSpanDefault: boolean;
  isEleDefault: boolean;
  personal: PersonalFilter;
};

/** [west, south, east, north] like GeoJSON. */
export type LonLatBounds = [number, number, number, number];

export const shortIdOfArea = (area: Pick<ClimbingArea, 'osmType' | 'osmId'>) =>
  `${area.osmType[0]}${area.osmId}`;

const MAP_TYPE_BY_DIGIT: Record<string, 'n' | 'w' | 'r'> = {
  '0': 'n',
  '1': 'w',
  '4': 'r',
};

/** Inverse of `convertOsmIdToMapId` (osmId * 10 + 0/1/4). */
export const shortIdFromMapId = (
  mapId: string | number | undefined,
): string | undefined => {
  if (mapId == null) return undefined;
  const text = String(mapId);
  if (!/^\d{2,}$/.test(text)) return undefined;
  const type = MAP_TYPE_BY_DIGIT[text.at(-1)!];
  return type ? `${type}${text.slice(0, -1)}` : undefined;
};

export const matchesPersonalFilter = (
  shortId: string,
  personal: PersonalFilter,
  sets: PersonalSets,
) => {
  switch (personal) {
    case 'favorites':
      return sets.favorites.has(shortId);
    case 'visited':
      return sets.visited.has(shortId);
    case 'notVisited':
      return !sets.visited.has(shortId);
    default:
      return true;
  }
};

/**
 * Country: with a selected country, ferratas without a known country are
 * hidden (we cannot tell where they are). Grade: unknown grades only match when
 * "Unbekannt" is selected. Measures: ferratas without measured geometry stay
 * visible, see `matchesFerrataMeasures`.
 */
export const matchesTourFilter = (
  area: ClimbingArea,
  filter: TourFilter,
  sets: PersonalSets,
  measure: FerrataMeasure | undefined = getFerrataMeasure(area.osmId),
) => {
  if (!matchesFerrataGrade(area.viaFerrataScale, filter.ferrataGrades)) {
    return false;
  }
  if (filter.ferrataCountries.length > 0) {
    const code = area.countryCode?.toLowerCase();
    if (!code || !filter.ferrataCountries.includes(code)) return false;
  }
  if (
    !matchesFerrataMeasures(measure, {
      lengthInterval: filter.lengthInterval,
      spanInterval: filter.spanInterval,
      eleInterval: filter.eleInterval,
      lengthDefault: filter.isLengthDefault,
      spanDefault: filter.isSpanDefault,
      eleDefault: filter.isEleDefault,
    })
  ) {
    return false;
  }
  return matchesPersonalFilter(shortIdOfArea(area), filter.personal, sets);
};

export const isInBounds = (
  area: Pick<ClimbingArea, 'lon' | 'lat'>,
  [west, south, east, north]: LonLatBounds,
) =>
  area.lat >= south &&
  area.lat <= north &&
  (west <= east
    ? area.lon >= west && area.lon <= east
    : area.lon >= west || area.lon <= east); // across the antimeridian

export const normalizeSearchText = (text: string) =>
  text
    .toLocaleLowerCase('de')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const tokens = (query: string) =>
  normalizeSearchText(query).split(' ').filter(Boolean);

export const MAX_QUERY_LENGTH = 80;

type Scored = { area: ClimbingArea; score: number };

/** Higher is better; 0 means no match. Every word must match name or place. */
const scoreArea = (area: ClimbingArea, words: string[], lang: string) => {
  if (!words.length) return 1;
  const name = normalizeSearchText(area.name ?? '');
  const place = normalizeSearchText(
    [area.city, getCountryName(area.countryCode, lang)]
      .filter(Boolean)
      .join(' '),
  );
  const nameWords = name.split(' ');
  let score = 0;
  for (const word of words) {
    if (nameWords.some((part) => part.startsWith(word))) score += 3;
    else if (name.includes(word)) score += 2;
    else if (place.includes(word)) score += 1;
    else return 0;
  }
  if (name.startsWith(words.join(' '))) score += 2;
  return score;
};

export type TourSearchInput = {
  query: string;
  filter: TourFilter;
  sets: PersonalSets;
  bounds?: LonLatBounds | null;
  lang?: string;
};

export type TourSearchResult = {
  /** All matches, best first. */
  results: ClimbingArea[];
  /** Matches of the text and map section before the other filters. */
  beforeFilters: number;
};

export const searchTours = (
  catalog: readonly ClimbingArea[],
  { query, filter, sets, bounds, lang = 'de' }: TourSearchInput,
): TourSearchResult => {
  const words = tokens(query.slice(0, MAX_QUERY_LENGTH));
  const scored: Scored[] = [];
  let beforeFilters = 0;
  for (const area of catalog) {
    if (!area.name && words.length) continue;
    if (bounds && !isInBounds(area, bounds)) continue;
    const score = scoreArea(area, words, lang);
    if (!score) continue;
    beforeFilters += 1;
    if (!matchesTourFilter(area, filter, sets)) continue;
    scored.push({ area, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.area.name ?? '').localeCompare(b.area.name ?? '', 'de') ||
      a.area.osmId - b.area.osmId,
  );
  return { results: scored.map(({ area }) => area), beforeFilters };
};

export const DEFAULT_TOUR_FILTER: TourFilter = {
  ferrataGrades: ALL_FERRATA_GRADES,
  ferrataCountries: [],
  lengthInterval: [0, 1500],
  spanInterval: [0, 1000],
  eleInterval: [0, 3000],
  isLengthDefault: true,
  isSpanDefault: true,
  isEleDefault: true,
  personal: 'all',
};

/** Rough bounds of a set of tours, padded so markers are not on the edge. */
export const boundsOfAreas = (
  areas: readonly Pick<ClimbingArea, 'lon' | 'lat'>[],
): LonLatBounds | null => {
  if (!areas.length) return null;
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const { lon, lat } of areas) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const pad = 0.01;
  return [west - pad, south - pad, east + pad, north + pad];
};

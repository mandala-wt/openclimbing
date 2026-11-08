import type { ClimbingArea } from '../../climbing-areas/getClimbingAreas';
import {
  DEFAULT_TOUR_FILTER,
  EMPTY_PERSONAL_SETS,
  isInBounds,
  matchesTourFilter,
  normalizeSearchText,
  searchTours,
  shortIdFromMapId,
  shortIdOfArea,
} from '../tourSearch';

const area = (over: Partial<ClimbingArea>): ClimbingArea => ({
  osmType: 'way',
  osmId: 1,
  name: 'Test',
  countryCode: 'de',
  cragCount: 0,
  routeCount: 0,
  routesWithPhoto: 0,
  lon: 11,
  lat: 49,
  viaFerrataScale: null,
  city: null,
  ...over,
});

const catalog = [
  area({
    osmId: 1156787758,
    name: 'Norissteig',
    city: 'Hirschbach',
    viaFerrataScale: 'B/C',
    lon: 11.53,
    lat: 49.54,
  }),
  area({
    osmId: 42213444,
    name: 'Lenzsteig',
    city: 'Veitsbronn',
    viaFerrataScale: 'B',
    lon: 9.76,
    lat: 49.99,
  }),
  area({
    osmId: 84013032,
    name: 'Tegelbergsteig',
    city: 'Schwangau',
    viaFerrataScale: 'D',
    lon: 10.77,
    lat: 47.56,
  }),
  area({
    osmType: 'relation',
    osmId: 7,
    name: 'Klettersteig Größe',
    city: 'Innsbruck',
    countryCode: 'at',
    viaFerrataScale: null,
    lon: 11.4,
    lat: 47.26,
  }),
  area({ osmId: 9, name: null, lon: 11.5, lat: 49.5 }),
];

describe('tour search', () => {
  it('normalizes umlauts, ß and punctuation', () => {
    expect(normalizeSearchText('Größe-Steig  (Süd)')).toBe('grosse steig sud');
  });

  it('finds tours by name prefix before place matches', () => {
    const { results } = searchTours(catalog, {
      query: 'nor',
      filter: DEFAULT_TOUR_FILTER,
      sets: EMPTY_PERSONAL_SETS,
    });
    expect(results.map((r) => r.name)).toEqual(['Norissteig']);
  });

  it('finds tours by place and by German country name', () => {
    const byCity = searchTours(catalog, {
      query: 'hirschbach',
      filter: DEFAULT_TOUR_FILTER,
      sets: EMPTY_PERSONAL_SETS,
    });
    expect(byCity.results.map((r) => r.name)).toEqual(['Norissteig']);
    const byCountry = searchTours(catalog, {
      query: 'österreich',
      filter: DEFAULT_TOUR_FILTER,
      sets: EMPTY_PERSONAL_SETS,
    });
    expect(byCountry.results.map((r) => r.name)).toEqual([
      'Klettersteig Größe',
    ]);
  });

  it('requires every word and ignores accents in the query', () => {
    const { results } = searchTours(catalog, {
      query: 'GROSSE innsbruck',
      filter: DEFAULT_TOUR_FILTER,
      sets: EMPTY_PERSONAL_SETS,
    });
    expect(results).toHaveLength(1);
    expect(
      searchTours(catalog, {
        query: 'grosse wien',
        filter: DEFAULT_TOUR_FILTER,
        sets: EMPTY_PERSONAL_SETS,
      }).results,
    ).toHaveLength(0);
  });

  it('keeps unnamed tours out of text searches but in the map list', () => {
    const empty = searchTours(catalog, {
      query: '',
      filter: DEFAULT_TOUR_FILTER,
      sets: EMPTY_PERSONAL_SETS,
    });
    expect(empty.results).toHaveLength(5);
  });

  it('combines text, map section and filters and reports matches before filters', () => {
    const result = searchTours(catalog, {
      query: 'steig',
      bounds: [9, 49, 12, 50.5],
      filter: { ...DEFAULT_TOUR_FILTER, ferrataGrades: ['C'] },
      sets: EMPTY_PERSONAL_SETS,
    });
    expect(result.beforeFilters).toBe(2);
    expect(result.results.map((r) => r.name)).toEqual(['Norissteig']);
  });

  it('treats unknown grades and countries explicitly', () => {
    const unknown = catalog[3];
    expect(
      matchesTourFilter(
        unknown,
        { ...DEFAULT_TOUR_FILTER, ferrataGrades: ['A', 'B'] },
        EMPTY_PERSONAL_SETS,
      ),
    ).toBe(false);
    expect(
      matchesTourFilter(
        unknown,
        { ...DEFAULT_TOUR_FILTER, ferrataGrades: ['unknown'] },
        EMPTY_PERSONAL_SETS,
      ),
    ).toBe(true);
    expect(
      matchesTourFilter(
        area({ countryCode: null }),
        { ...DEFAULT_TOUR_FILTER, ferrataCountries: ['de'] },
        EMPTY_PERSONAL_SETS,
      ),
    ).toBe(false);
  });

  it('keeps tours without measured geometry visible in measure filters', () => {
    expect(
      matchesTourFilter(
        area({ osmId: 123 }),
        {
          ...DEFAULT_TOUR_FILTER,
          lengthInterval: [100, 200],
          isLengthDefault: false,
        },
        EMPTY_PERSONAL_SETS,
        undefined,
      ),
    ).toBe(true);
    expect(
      matchesTourFilter(
        area({ osmId: 123 }),
        {
          ...DEFAULT_TOUR_FILTER,
          lengthInterval: [100, 200],
          isLengthDefault: false,
        },
        EMPTY_PERSONAL_SETS,
        { lengthM: 50, spanM: 10, eleM: null },
      ),
    ).toBe(false);
  });

  it('filters by favourites and visited ferratas', () => {
    const sets = {
      favorites: new Set(['w42213444']),
      visited: new Set(['w1156787758']),
    };
    const pick = (personal: typeof DEFAULT_TOUR_FILTER.personal) =>
      searchTours(catalog, {
        query: '',
        filter: { ...DEFAULT_TOUR_FILTER, personal },
        sets,
      }).results.map((r) => r.name);
    expect(pick('favorites')).toEqual(['Lenzsteig']);
    expect(pick('visited')).toEqual(['Norissteig']);
    expect(pick('notVisited')).not.toContain('Norissteig');
  });

  it('converts between short ids and map ids', () => {
    expect(shortIdOfArea(catalog[0])).toBe('w1156787758');
    expect(shortIdFromMapId(11567877581)).toBe('w1156787758');
    expect(shortIdFromMapId('74')).toBe('r7');
    expect(shortIdFromMapId('70')).toBe('n7');
    expect(shortIdFromMapId('73')).toBeUndefined();
    expect(shortIdFromMapId(undefined)).toBeUndefined();
  });

  it('handles map sections across the antimeridian', () => {
    expect(isInBounds({ lon: 179.5, lat: 0 }, [179, -1, -179, 1])).toBe(true);
    expect(isInBounds({ lon: 0, lat: 0 }, [179, -1, -179, 1])).toBe(false);
  });
});

import {
  cardinalFromBearing,
  distanceToTrackMeters,
  formatMeters,
  haversineMeters,
  normalizeBearing,
} from '../geo';
import {
  formatDecimal,
  formatDms,
  formatPosition,
  setCoordinateEncoders,
} from '../coordinates';
import { buildTourPack } from '../pack';
import { tracksFromOsmElements } from '../osmGeometry';
import { formatBytes, quotaProblem } from '../limits';
import { createMemoryRepository, QuotaError } from '../repository';
import { fieldReadout } from '../readout';
import { positionShareText } from '../shareText';
import { shouldStoreInShellCache, MAX_CACHE_ENTRIES } from '../cachePolicy';
import { MAP_TILES_NOTE } from '../types';

const field = require('../../../../public/kletterglueck-field.js');

describe('offline geometry', () => {
  const wuerzburg = { lon: 9.9375, lat: 49.7944 };
  const east = { lon: 9.952, lat: 49.7944 };

  test('measures a short east-west distance without inventing elevation', () => {
    const meters = haversineMeters(wuerzburg, east);
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
    expect(field.haversineMeters(wuerzburg, east)).toBeCloseTo(meters, 3);
    expect(formatMeters(meters)).toMatch(/km$/);
  });

  test('bearing east is O and wraps negative degrees', () => {
    expect(cardinalFromBearing(90)).toBe('O');
    expect(field.cardinalFromBearing(90)).toBe('O');
    expect(normalizeBearing(-10)).toBeCloseTo(350);
  });

  test('distance to a track is zero on the line and null without points', () => {
    const line = [
      { lon: 11.52, lat: 49.55 },
      { lon: 11.53, lat: 49.55 },
    ];
    expect(
      distanceToTrackMeters({ lon: 11.525, lat: 49.55 }, line),
    ).toBeLessThan(5);
    expect(distanceToTrackMeters({ lon: 11.525, lat: 49.55 }, [])).toBeNull();
    expect(
      field.distanceToTrackMeters({ lon: 11.525, lat: 49.55 }, line),
    ).toBeLessThan(5);
  });
});

describe('offline tour packs', () => {
  const elements = [
    { type: 'node', id: 1, lat: 49.55174, lon: 11.52507 },
    { type: 'node', id: 2, lat: 49.546417, lon: 11.523 },
    { type: 'node', id: 4, lat: 49.551741, lon: 11.524927 },
    {
      type: 'way',
      id: 1156787758,
      timestamp: '2026-11-06T08:00:00Z',
      nodes: [1, 2, 3, 4],
      tags: {
        name: 'Norissteig',
        highway: 'via_ferrata',
        via_ferrata_scale: '2',
        description: 'Gesicherter Steig.',
        note: 'nicht als Beschreibung übernehmen',
      },
    },
  ];

  test('keeps a gap where a node has no coordinates and ignores non-description tags', () => {
    const { tracks, osmTimestamp } = tracksFromOsmElements(
      elements,
      { type: 'way', id: 1156787758 },
      '2026-11-09T00:00:00Z',
    );
    expect(osmTimestamp).toBe('2026-11-06T08:00:00Z');
    expect(tracks).toHaveLength(1);
    expect(tracks[0].points).toEqual([
      { lon: 11.52507, lat: 49.55174 },
      { lon: 11.523, lat: 49.546417 },
    ]);
    expect(tracks[0].label).not.toContain('Teil');
    const pack = buildTourPack({
      osmType: 'way',
      osmId: 1156787758,
      tags: elements[3].tags,
      lon: 11.5306697,
      lat: 49.5441152,
      osmTimestamp,
      tracks: tracks.filter((track) => track.points.length >= 2),
      savedAt: '2026-11-09T00:00:00Z',
    });
    expect(pack.name).toBe('Norissteig');
    expect(pack.difficulty).toEqual([{ key: 'via_ferrata_scale', value: '2' }]);
    expect(pack.description).toEqual([
      { key: 'description', value: 'Gesicherter Steig.' },
    ]);
    expect(JSON.stringify(pack)).not.toContain('nicht als Beschreibung');
    expect(pack.mapTilesIncluded).toBe(false);
    expect(pack.mapTilesNote).toBe(MAP_TILES_NOTE);
    expect(pack.bytes).toBeGreaterThan(200);
  });

  test('does not invent a name or a location', () => {
    const pack = buildTourPack({
      osmType: 'node',
      osmId: 9,
      tags: {},
      savedAt: '2026-11-09T00:00:00Z',
    });
    expect(pack.nameFromOsm).toBe(false);
    expect(pack.name).toBe('node/9');
    expect(pack.lat).toBeNull();
    expect(pack.tracks).toEqual([]);
  });

  test('refuses to grow past the tour or byte cap and deletes one pack', async () => {
    const small = buildTourPack({
      osmType: 'node',
      osmId: 1,
      tags: { name: 'A' },
      lat: 1,
      lon: 2,
      savedAt: '2026-11-09T00:00:00Z',
    });
    const packs = Array.from({ length: 24 }, (_, index) => ({
      ...small,
      id: `node/${index}`,
      osmId: index,
    }));
    expect(quotaProblem(packs, { ...small, id: 'node/99', osmId: 99 })).toBe(
      'count',
    );
    const repository = createMemoryRepository([small]);
    await repository.delete(small.id);
    expect(await repository.list()).toEqual([]);
    await expect(repository.put(packs[0])).resolves.toBeUndefined();
    const overstuffed = Array.from({ length: 24 }, (_, index) => ({
      ...small,
      id: `node/${index + 10}`,
      osmId: index + 10,
      bytes: 400_000,
    }));
    expect(quotaProblem([], { ...overstuffed[0], bytes: 9_000_000 })).toBe(
      'bytes',
    );
    const full = createMemoryRepository(overstuffed);
    await expect(
      full.put({ ...small, id: 'node/1', bytes: 400_000 }),
    ).rejects.toBeInstanceOf(QuotaError);
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('offline readout and cache', () => {
  test('omits distances and elevation when the inputs are absent', () => {
    const pack = buildTourPack({
      osmType: 'way',
      osmId: 5,
      tags: { name: 'Stein' },
      lat: 47,
      lon: 11,
      tracks: [
        {
          id: 'way/5',
          label: 'Linie',
          source: 'OSM',
          readAt: '2026-11-09T00:00:00Z',
          points: [
            { lon: 11, lat: 47 },
            { lon: 11.001, lat: 47 },
          ],
        },
      ],
      savedAt: '2026-11-09T00:00:00Z',
    });
    expect(
      fieldReadout(pack, pack.tracks[0].points, null).distanceStart,
    ).toBeNull();
    const readout = fieldReadout(pack, pack.tracks[0].points, {
      lon: 11.0005,
      lat: 47.001,
      altitude: null,
    });
    expect(readout.distanceStart).not.toBe('–');
    expect(readout.nearestElevation).toBeNull();
    expect(readout.bearingToNearest).toMatch(/°/);
  });

  test('formats real coordinates and does not cache foreign tiles', () => {
    setCoordinateEncoders({
      plusCode: () => '8FXHGGVJ+J7',
      mgrs: () => '32UPV8306591022',
    });
    expect(formatDecimal(49.544115, 11.53067)).toBe('49.544115, 11.530670');
    expect(formatDms(49.544115, 11.53067)).toContain('N');
    const text = positionShareText(
      {
        lat: 49.544115,
        lon: 11.53067,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        timestamp: Date.UTC(2026, 10, 9, 10, 0, 0),
      },
      formatPosition(49.544115, 11.53067),
    );
    expect(text).toContain('Plus-Code: 8FXHGGVJ+J7');
    expect(text).toContain('Genauigkeit der Ortung: 12 m');
    expect(text).not.toContain('Höhe laut Ortung');
    expect(text).toContain('Keine Aussage');
    expect(
      shouldStoreInShellCache(
        'https://tile.openstreetmap.org/1/2/3.png',
        'https://app.test',
      ),
    ).toBe(false);
    expect(
      shouldStoreInShellCache(
        'https://api.maptiler.com/tiles/a/1/2/3.png',
        'https://app.test',
      ),
    ).toBe(false);
    expect(
      shouldStoreInShellCache('https://app.test/api/user', 'https://app.test'),
    ).toBe(false);
    expect(
      shouldStoreInShellCache(
        'https://app.test/way/1156787758',
        'https://app.test',
      ),
    ).toBe(true);
    expect(
      shouldStoreInShellCache(
        'https://app.test/unterwegs.html',
        'https://app.test',
      ),
    ).toBe(true);
    expect(MAX_CACHE_ENTRIES).toBeLessThan(200);
    expect(field.formatDecimal(49.5, 11.5)).toBe('49.500000, 11.500000');
  });
});

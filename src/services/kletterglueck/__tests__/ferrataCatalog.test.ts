import {
  loadFerrataCatalog,
  mapIdOfArea,
  resetFerrataCatalogForTests,
} from '../ferrataCatalog';
import { fetchJson } from '../../fetch';

jest.mock('../../fetch', () => ({ fetchJson: jest.fn() }));
const fetchMock = fetchJson as jest.Mock;

const row = {
  osmType: 'way',
  osmId: 1156787758,
  name: 'Norissteig',
  countryCode: 'de',
  lon: 11.53,
  lat: 49.54,
};

beforeEach(() => {
  resetFerrataCatalogForTests();
  fetchMock.mockReset();
});

test('loads once and indexes by map id and short id', async () => {
  fetchMock.mockResolvedValue([row]);
  const [a, b] = await Promise.all([
    loadFerrataCatalog(),
    loadFerrataCatalog(),
  ]);
  expect(a).toBe(b);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(a.index.byShortId.get('w1156787758')?.name).toBe('Norissteig');
  expect(a.index.byMapId.get(11567877581)?.name).toBe('Norissteig');
  await loadFerrataCatalog();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('reports errors and an unexpected format, then retries', async () => {
  fetchMock.mockRejectedValueOnce(new Error('503'));
  await expect(loadFerrataCatalog()).rejects.toThrow('503');
  fetchMock.mockResolvedValueOnce({ not: 'a list' });
  await expect(loadFerrataCatalog()).rejects.toThrow('unerwartetes Format');
  fetchMock.mockResolvedValueOnce([row]);
  await expect(loadFerrataCatalog()).resolves.toMatchObject({
    catalog: [row],
  });
});

test('map ids match convertOsmIdToMapId', () => {
  expect(mapIdOfArea({ osmType: 'node', osmId: 5 })).toBe(50);
  expect(mapIdOfArea({ osmType: 'relation', osmId: 5 })).toBe(54);
});

import { act, renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CENTRAL_TOUR_SOURCE } from '../centralToursIds';
import {
  bboxContains,
  paddedTourBbox,
  useCentralTours,
} from '../useCentralTours';

test('loads shared tracks on map entry, restores them after a style change and removes the overlay on exit', async () => {
  const oldFetch = global.fetch;
  const track = [
    [
      [11.525, 49.552],
      [11.53, 49.549],
    ],
  ];
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tours: [{ id: 'noris', track }], truncated: false }),
  });
  global.fetch = fetchMock;
  jest.useFakeTimers();
  const listeners = new Map<string, () => void>();
  const layers = new Set<string>();
  const sources = new Map<string, { data: unknown; setData: jest.Mock }>();
  const map = {
    getBounds: () => ({
      getWest: () => 11.5,
      getEast: () => 11.6,
      getSouth: () => 49.5,
      getNorth: () => 49.6,
    }),
    getZoom: () => 15,
    isStyleLoaded: () => true,
    on: (event, listener) => listeners.set(event, listener),
    off: (event) => listeners.delete(event),
    getSource: (id) => sources.get(id),
    addSource: (id, { data }) => sources.set(id, { data, setData: jest.fn() }),
    removeSource: (id) => sources.delete(id),
    addLayer: ({ id }) => layers.add(id),
    getLayer: (id) => layers.has(id),
    removeLayer: (id) => layers.delete(id),
  };
  const isPicking = () => false;
  try {
    const { unmount } = renderHook(() =>
      useCentralTours(map as unknown as MapLibreMap, isPicking),
    );
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      'bbox=11.45,49.45,11.65,49.65',
    );
    expect(sources.get(CENTRAL_TOUR_SOURCE)?.data).toMatchObject({
      features: [
        { geometry: { type: 'MultiLineString', coordinates: track } },
        { geometry: { type: 'Point' } },
      ],
    });
    sources.clear();
    layers.clear();
    listeners.get('style.load')?.();
    expect(sources.size).toBe(1);
    expect(layers.size).toBe(2);
    unmount();
    expect(sources.size).toBe(0);
    expect(layers.size).toBe(0);
  } finally {
    global.fetch = oldFetch;
    jest.useRealTimers();
  }
});

test('zeigt keinen Hinweis, wenn gespeicherte Touren nicht geladen werden', async () => {
  const oldFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({}),
  });
  jest.useFakeTimers();
  const map = {
    getBounds: () => ({
      getWest: () => 11.5,
      getEast: () => 11.6,
      getSouth: () => 49.5,
      getNorth: () => 49.6,
    }),
    getZoom: () => 15,
    isStyleLoaded: () => true,
    on: () => undefined,
    off: () => undefined,
    getSource: () => undefined,
    addSource: () => undefined,
    removeSource: () => undefined,
    addLayer: () => undefined,
    getLayer: () => false,
    removeLayer: () => undefined,
  };
  try {
    const { result } = renderHook(() =>
      useCentralTours(map as unknown as MapLibreMap, () => false),
    );
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe('');
  } finally {
    global.fetch = oldFetch;
    jest.useRealTimers();
  }
});

test('requests a padded box and reuses it while panning inside', async () => {
  const oldFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ tours: [], truncated: false }),
  });
  global.fetch = fetchMock;
  jest.useFakeTimers();
  let west = 11.5;
  const listeners = new Map<string, () => void>();
  const map = {
    getBounds: () => ({
      getWest: () => west,
      getEast: () => west + 0.1,
      getSouth: () => 49.5,
      getNorth: () => 49.6,
    }),
    getZoom: () => 14,
    isStyleLoaded: () => true,
    on: (event, listener) => listeners.set(event, listener),
    off: () => undefined,
    getSource: () => undefined,
    addSource: () => undefined,
    removeSource: () => undefined,
    addLayer: () => undefined,
    getLayer: () => false,
    removeLayer: () => undefined,
  };
  try {
    renderHook(() =>
      useCentralTours(map as unknown as MapLibreMap, () => false),
    );
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // small pan inside the padded box: no request
    west = 11.52;
    await act(async () => {
      listeners.get('moveend')?.();
      jest.advanceTimersByTime(250);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // leaving the box: one new request
    west = 11.9;
    await act(async () => {
      listeners.get('moveend')?.();
      jest.advanceTimersByTime(250);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    global.fetch = oldFetch;
    jest.useRealTimers();
  }
});

test('padded boxes stay within the API limits', () => {
  expect(paddedTourBbox([11.5, 49.5, 11.6, 49.6])).toEqual([
    11.45, 49.45, 11.65, 49.65,
  ]);
  // already wide views are not padded beyond 8°
  expect(paddedTourBbox([0, 0, 6, 6])).toEqual([0, 0, 6, 6]);
  expect(bboxContains([0, 0, 2, 2], [0.5, 0.5, 1, 1])).toBe(true);
  expect(bboxContains([0, 0, 2, 2], [1.5, 0.5, 2.5, 1])).toBe(false);
});

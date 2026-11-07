import { act, renderHook } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CENTRAL_TOUR_SOURCE } from '../centralToursIds';
import { useCentralTours } from '../useCentralTours';

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
    expect(fetchMock.mock.calls[0][0]).toContain('bbox=11.5,49.5,11.6,49.6');
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

test.each([502, 503, 'network'])(
  'reports %s failures, recovers and stops loading a disabled store',
  async (failure) => {
    const oldFetch = global.fetch;
    const fetchMock = jest.fn();
    const fail = () =>
      failure === 'network'
        ? fetchMock.mockRejectedValue(new Error('offline'))
        : fetchMock.mockResolvedValue({ ok: false, status: failure });
    fail();
    global.fetch = fetchMock;
    jest.useFakeTimers();
    const listeners = new Map<string, () => void>();
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
      getSource: jest.fn(),
      getLayer: jest.fn(),
    };
    const isPicking = () => false;
    try {
      const { result, unmount } = renderHook(() =>
        useCentralTours(map as unknown as MapLibreMap, isPicking),
      );
      await act(async () => {
        jest.advanceTimersByTime(250);
      });
      expect(result.current).toBe(
        'Gespeicherte Touren konnten gerade nicht geladen werden.',
      );
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ tours: [], truncated: false }),
      });
      await act(async () => {
        listeners.get('moveend')?.();
        jest.advanceTimersByTime(250);
      });
      expect(result.current).toBe('');
      fail();
      await act(async () => {
        listeners.get('moveend')?.();
        jest.advanceTimersByTime(250);
      });
      expect(result.current).not.toBe('');
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      await act(async () => {
        listeners.get('moveend')?.();
        jest.advanceTimersByTime(250);
      });
      expect(result.current).toBe('');
      await act(async () => {
        listeners.get('moveend')?.();
        jest.advanceTimersByTime(250);
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
      unmount();
    } finally {
      global.fetch = oldFetch;
      jest.useRealTimers();
    }
  },
);

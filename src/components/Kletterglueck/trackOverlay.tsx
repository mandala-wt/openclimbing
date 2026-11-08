import { useEffect, useMemo } from 'react';
import { useSyncExternalStore } from './useExternalStore';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, MultiLineString } from 'geojson';
import type { TrackSegment } from '../../services/kletterglueck/gpx';
import { usePersonalData } from '../utils/PersonalDataContext';

export type OverlayKind = 'personal' | 'preview' | 'reference';

type OverlayTrack = { id: string; kind: OverlayKind; segments: TrackSegment[] };

const SOURCE = 'kletterglueck-track-overlay';
const LINE = `${SOURCE}-line`;
const CASING = `${SOURCE}-casing`;

// Small external store: details, import dialog and collection can show a
// track without knowing the map.
let shown: OverlayTrack[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const showTrack = (track: OverlayTrack) => {
  shown = [...shown.filter(({ id }) => id !== track.id), track];
  emit();
};
export const hideTrack = (id: string) => {
  if (!shown.some((track) => track.id === id)) return;
  shown = shown.filter((track) => track.id !== id);
  emit();
};
export const isTrackShown = (id: string) => shown.some((t) => t.id === id);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useShownTracks = () =>
  useSyncExternalStore(
    subscribe,
    () => shown,
    () => shown,
  );

const COLORS: Record<OverlayKind, string> = {
  personal: '#7b2cbf',
  preview: '#d1495b',
  reference: '#1759c7',
};

const toCollection = (
  tracks: OverlayTrack[],
): FeatureCollection<MultiLineString> => ({
  type: 'FeatureCollection',
  features: tracks.map(({ id, kind, segments }) => ({
    type: 'Feature',
    properties: { id, kind, color: COLORS[kind] },
    geometry: { type: 'MultiLineString', coordinates: segments },
  })),
});

/** Draws personal tracks (always) plus temporarily shown tracks. */
export const useTrackOverlay = (map: MapLibreMap | undefined) => {
  const { store } = usePersonalData();
  const temporary = useShownTracks();
  const data = useMemo(() => {
    const personal = store.tracks
      .filter((track) => !temporary.some(({ id }) => id === track.id))
      .map(
        (track): OverlayTrack => ({
          id: track.id,
          kind: 'personal',
          segments: track.segments,
        }),
      );
    return toCollection([...personal, ...temporary]);
  }, [store.tracks, temporary]);

  useEffect(() => {
    if (!map) return undefined;
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource(SOURCE, { type: 'geojson', data });
      map.addLayer({
        id: CASING,
        type: 'line',
        source: SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-dasharray': [
            'case',
            ['==', ['get', 'kind'], 'preview'],
            ['literal', [2, 1.5]],
            ['literal', [1, 0]],
          ],
        },
      });
    };
    ensure();
    map.on('style.load', ensure);
    map.on('load', ensure);
    return () => {
      map.off('style.load', ensure);
      map.off('load', ensure);
    };
  }, [map, data]);
};

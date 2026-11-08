import { useEffect, useState } from 'react';
import { Popup } from 'maplibre-gl';
import type { Map, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import type { FeatureCollection, MultiLineString, Point } from 'geojson';
import type { Tour } from '../../services/tours/tracks';
import {
  CENTRAL_TOUR_SOURCE,
  CENTRAL_TOUR_LINE,
  CENTRAL_TOUR_START,
} from './centralToursIds';

const collection = (
  tours: Tour[],
): FeatureCollection<MultiLineString | Point> => ({
  type: 'FeatureCollection',
  features: tours.flatMap(({ track, id }) => [
    {
      type: 'Feature',
      properties: { id },
      geometry: { type: 'MultiLineString', coordinates: track },
    },
    {
      type: 'Feature',
      properties: { id },
      geometry: { type: 'Point', coordinates: track[0][0] },
    },
  ]),
});

const popupContent = ({
  name,
  difficulty,
  duration_minutes,
  length_m,
  source,
  attribution,
  osm_ref,
}: Tour) => {
  const root = document.createElement('div');
  root.style.color = '#222';
  const title = document.createElement('strong');
  title.textContent = name;
  root.append(title);
  const info = document.createElement('div');
  info.textContent = [
    difficulty,
    duration_minutes && duration_minutes + ' min',
    (length_m / 1000).toFixed(2) + ' km',
  ]
    .filter(Boolean)
    .join(' · ');
  root.append(info);
  const credit = document.createElement('small');
  credit.textContent = [source, attribution].filter(Boolean).join(' · ');
  root.append(credit);
  if (osm_ref) {
    const detail = document.createElement('a');
    detail.href = '/' + osm_ref;
    detail.style.display = 'block';
    detail.textContent = 'Klettersteig-Details';
    root.append(detail);
  }
  return root;
};

type Bbox = [west: number, south: number, east: number, north: number];

const MIN_ZOOM = 11;
/** Grid for padded requests, so small pans reuse the last answer. */
const GRID = 0.05;

/**
 * Requests a padded, grid-aligned box around the view (max 8° like the API).
 * Panning inside the box needs no new request.
 */
export const paddedTourBbox = ([west, south, east, north]: Bbox): Bbox => {
  const padX = (east - west) / 2;
  const padY = (north - south) / 2;
  // The epsilon keeps 11.45 / 0.05 from becoming 228.999… in floating point.
  const snapDown = (value: number) => Math.floor(value / GRID + 1e-9) * GRID;
  const snapUp = (value: number) => Math.ceil(value / GRID - 1e-9) * GRID;
  const box: Bbox = [
    Math.max(-180, snapDown(west - padX)),
    Math.max(-90, snapDown(south - padY)),
    Math.min(180, snapUp(east + padX)),
    Math.min(90, snapUp(north + padY)),
  ];
  if (box[2] - box[0] > 8 || box[3] - box[1] > 8) {
    return [west, south, east, north];
  }
  return box.map((value) => Number(value.toFixed(4))) as Bbox;
};

export const bboxContains = (outer: Bbox, inner: Bbox) =>
  inner[0] >= outer[0] &&
  inner[1] >= outer[1] &&
  inner[2] <= outer[2] &&
  inner[3] <= outer[3];

export const useCentralTours = (
  map: Map | undefined,
  mapClickOverridden: () => boolean,
) => {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!map) return undefined;

    let tours: Tour[] = [];
    let data = collection(tours);
    let activeRequest: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disabled = false;
    let popup: Popup | undefined;
    // Last complete (not truncated) answer and the box it covers.
    let covered: Bbox | null = null;
    let cachedTours: Tour[] = [];

    const restore = () => {
      if (map.getSource(CENTRAL_TOUR_SOURCE) || !tours.length) return;
      map.addSource(CENTRAL_TOUR_SOURCE, { type: 'geojson', data });
      map.addLayer({
        id: CENTRAL_TOUR_LINE,
        type: 'line',
        source: CENTRAL_TOUR_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1759c7', 'line-width': 4 },
      });
      map.addLayer({
        id: CENTRAL_TOUR_START,
        type: 'circle',
        source: CENTRAL_TOUR_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#1759c7',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });
    };

    const setTours = (next: Tour[]) => {
      tours = next;
      data = collection(next);
      const source = map.getSource(CENTRAL_TOUR_SOURCE) as
        | GeoJSONSource
        | undefined;
      if (source) source.setData(data);
      else if (map.isStyleLoaded()) restore();
    };

    const refresh = async () => {
      const bounds = map.getBounds();
      const view: Bbox = [
        Math.max(-180, bounds.getWest()),
        Math.max(-90, bounds.getSouth()),
        Math.min(180, bounds.getEast()),
        Math.min(90, bounds.getNorth()),
      ];
      if (
        map.getZoom() < MIN_ZOOM ||
        view[0] >= view[2] ||
        view[1] >= view[3]
      ) {
        // Keep the cached answer: zooming back in shows it without a request.
        setTours([]);
        setNotice('');
        return;
      }
      if (covered && bboxContains(covered, view)) {
        if (!tours.length && cachedTours.length) setTours(cachedTours);
        return;
      }
      const controller = new AbortController();
      activeRequest = controller;
      const load = async (bbox: Bbox) => {
        const response = await fetch(
          '/api/kletterglueck/tours?bbox=' + bbox.join(','),
          { signal: controller.signal },
        );
        if (response.status === 404 || response.status === 503) {
          // Not configured here; stop asking on every pan.
          disabled = true;
          return null;
        }
        if (!response.ok) throw new Error('Tourenspeicher nicht verfügbar');
        return (await response.json()) as {
          tours: Tour[];
          truncated: boolean;
        };
      };
      try {
        const padded = paddedTourBbox(view);
        let bbox = padded;
        let result = await load(padded);
        if (result?.truncated && padded.join() !== view.join()) {
          // Dense area: the padded box was too much, ask for the view only.
          bbox = view;
          result = await load(view);
        }
        if (controller.signal.aborted) return;
        if (!result) {
          setTours([]);
          setNotice('');
          return;
        }
        cachedTours = result.tours;
        covered = result.truncated ? null : bbox;
        setTours(result.tours);
        setNotice(
          result.truncated
            ? 'Zoome näher heran, um Touren in einem kleineren Ausschnitt zu sehen.'
            : '',
        );
      } catch {
        if (controller.signal.aborted) return;
        setTours([]);
        setNotice('');
      }
    };

    const schedule = () => {
      if (disabled) return;
      activeRequest?.abort();
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 250);
    };
    const showDetails = (event: MapLayerMouseEvent) => {
      if (mapClickOverridden()) return;
      const tour = tours.find(
        (row) => row.id === event.features?.[0]?.properties?.id,
      );
      if (!tour) return;
      popup?.remove();
      popup = new Popup({ maxWidth: '280px' })
        .setLngLat(event.lngLat)
        .setDOMContent(popupContent(tour))
        .addTo(map);
    };

    map.on('style.load', restore);
    map.on('moveend', schedule);
    map.on('click', CENTRAL_TOUR_START, showDetails);
    schedule();

    return () => {
      clearTimeout(timer);
      activeRequest?.abort();
      popup?.remove();
      map.off('style.load', restore);
      map.off('moveend', schedule);
      map.off('click', CENTRAL_TOUR_START, showDetails);
      for (const layer of [CENTRAL_TOUR_START, CENTRAL_TOUR_LINE]) {
        if (map.getLayer(layer)) map.removeLayer(layer);
      }
      if (map.getSource(CENTRAL_TOUR_SOURCE))
        map.removeSource(CENTRAL_TOUR_SOURCE);
    };
  }, [map, mapClickOverridden]);
  return notice;
};

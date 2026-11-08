import Router from 'next/router';
import { getGlobalMap } from '../../services/mapStorage';
import { getFeaturePanelWidth } from '../utils/featurePanelWidth';
import { isMobileModeVanilla } from '../helpers';
import type { OsmType } from '../../services/types';

type TourRef = {
  osmType: OsmType;
  osmId: number;
  lon: number;
  lat: number;
};

const MIN_TOUR_ZOOM = 14;

/** Visible map area: on phones the sheet covers the lower half. */
export const visibleMapPadding = () => {
  if (typeof window === 'undefined') return undefined;
  if (isMobileModeVanilla()) {
    return {
      top: 60,
      bottom: Math.round(window.innerHeight * 0.5),
      left: 20,
      right: 20,
    };
  }
  return { top: 60, bottom: 40, left: getFeaturePanelWidth() + 20, right: 60 };
};

/** Moves the map to the tour and opens its details (keeps a way back). */
export const openTourOnMap = (tour: TourRef, back?: string) => {
  const map = getGlobalMap();
  if (map) {
    map.flyTo({
      center: [tour.lon, tour.lat],
      zoom: Math.max(map.getZoom(), MIN_TOUR_ZOOM),
      padding: visibleMapPadding(),
      essential: true,
      duration: 800,
    });
  }
  const query = back ? `?back=${encodeURIComponent(back)}` : '';
  return Router.push(`/${tour.osmType}/${tour.osmId}${query}`);
};

/** Fits a bounding box ([west, south, east, north]) into the visible area. */
export const fitBoundsOnMap = (bounds: [number, number, number, number]) => {
  const map = getGlobalMap();
  if (!map) return;
  map.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { padding: visibleMapPadding(), maxZoom: 16, duration: 600 },
  );
};

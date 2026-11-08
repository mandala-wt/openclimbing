export type OsmElementType = 'node' | 'way' | 'relation';

export type TrackPoint = {
  lon: number;
  lat: number;
  /** Present only when the source itself had an elevation. */
  ele?: number;
};

export type StoredTrack = {
  id: string;
  label: string;
  source: string;
  readAt: string;
  points: TrackPoint[];
};

export type TagPair = {
  key: string;
  value: string;
};

export type TourPack = {
  id: string;
  osmType: OsmElementType;
  osmId: number;
  name: string;
  /** False when OpenStreetMap has no name tag. `name` is then the OSM id. */
  nameFromOsm: boolean;
  lat: number | null;
  lon: number | null;
  locationSource: string | null;
  difficulty: TagPair[];
  description: TagPair[];
  osmTimestamp: string | null;
  savedAt: string;
  tracks: StoredTrack[];
  mapTilesIncluded: false;
  mapTilesNote: string;
  attribution: string;
  bytes: number;
};

export const MAP_TILES_NOTE =
  'Kein Kartenausschnitt. MapTiler, der OpenStreetMap-Kachelserver, Thunderforest, Bing und die übrigen eingebundenen Karten erlauben das Herunterladen von Kacheln für die Offline-Nutzung nicht. Gespeichert sind nur die hier angezeigten Sachdaten.';

export const OSM_ATTRIBUTION = '© OpenStreetMap-Mitwirkende, ODbL';

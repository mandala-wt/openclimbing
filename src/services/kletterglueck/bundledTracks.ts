/** Tracks shipped with the app. Only openly licensed files belong here. */
export type BundledTrack = {
  id: string;
  shortId: string;
  title: string;
  url: string;
  fileName: string;
  description: string;
  license: string;
  sourceUrl: string;
};

export const BUNDLED_TRACKS: BundledTrack[] = [
  {
    id: 'norissteig-osm-variante',
    shortId: 'w1156787758',
    title: 'Rundtour ab Hirschbach (OSM-Variante)',
    url: '/kletterglueck/tracks/norissteig-osm-variante.gpx',
    fileName: 'norissteig-osm-variante.gpx',
    description:
      'Zustieg, Norissteig und Rückweg in drei Abschnitten aus OpenStreetMap. Ohne die gesicherte Brettl-Querung. Kein Originaltrack, nicht vor Ort geprüft.',
    license: '© OpenStreetMap-Mitwirkende, ODbL 1.0',
    sourceUrl: 'https://www.openstreetmap.org/relation/949200',
  },
];

export const bundledTracksFor = (shortId: string) =>
  BUNDLED_TRACKS.filter((track) => track.shortId === shortId);

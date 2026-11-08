import { getOsmFullUrl } from '../osm/urls';
import { MAX_OSM_DOCUMENT_BYTES } from './limits';
import { OsmElement, tracksFromOsmElements } from './osmGeometry';
import { OsmElementType, StoredTrack } from './types';

export class OsmTrackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OsmTrackError';
  }
}

type OsmDocument = { elements?: OsmElement[] };

const timeoutSignal = (): AbortSignal | undefined =>
  typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(20_000)
    : undefined;

export const loadOsmTracks = async (
  osmType: OsmElementType,
  osmId: number,
  readAt: string,
): Promise<{ tracks: StoredTrack[]; osmTimestamp: string | null }> => {
  if (osmType === 'node') return { tracks: [], osmTimestamp: null };

  const url = getOsmFullUrl({ type: osmType, id: osmId });
  let response: Response;
  try {
    response = await fetch(url, { signal: timeoutSignal() });
  } catch {
    throw new OsmTrackError(
      'Die Linie konnte nicht von OpenStreetMap geladen werden. Es wurde nichts gespeichert.',
    );
  }
  if (!response.ok) {
    throw new OsmTrackError(
      `OpenStreetMap hat mit ${response.status} geantwortet. Es wurde nichts gespeichert.`,
    );
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_OSM_DOCUMENT_BYTES) {
    throw new OsmTrackError(
      'Die OpenStreetMap-Antwort ist zu groß für den begrenzten Offline-Speicher. Es wurde nichts gespeichert.',
    );
  }
  let document: OsmDocument;
  try {
    document = JSON.parse(text) as OsmDocument;
  } catch {
    throw new OsmTrackError(
      'OpenStreetMap hat keine lesbare Linie geliefert. Es wurde nichts gespeichert.',
    );
  }
  return tracksFromOsmElements(
    document.elements ?? [],
    { type: osmType, id: osmId },
    readAt,
  );
};

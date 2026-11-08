import { Feature } from '../types';
import type { FeatureCollection, LineString } from 'geojson';

const DB_NAME = 'kletterglueck-offline';
const DB_VERSION = 1;
const STORE_NAME = 'tours';

export interface SavedTour {
  shortId: string;
  name: string;
  center: [number, number];
  difficulty?: string;
  description?: string;
  tags: Record<string, string>;
  track?: FeatureCollection<LineString>;
  savedAt: string; // ISO
  sizeBytes: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'shortId' });
      }
    };
  });
}

export async function estimateTourSize(
  feature: Feature,
  track?: FeatureCollection,
): Promise<number> {
  const data = {
    shortId: feature.osmMeta?.id ? `w${feature.osmMeta.id}` : 'unknown',
    name: feature.tags?.name || 'Unbenannt',
    center: feature.center || [0, 0],
    difficulty: feature.tags?.['climbing:grade:via_ferrata'] || feature.tags?.['via_ferrata:scale'],
    description: feature.tags?.description || feature.tags?.['description:de'],
    tags: feature.tags || {},
    track,
  };
  return new Blob([JSON.stringify(data)]).size;
}

export async function saveTour(
  feature: Feature,
  track?: FeatureCollection<LineString>,
): Promise<SavedTour> {
  const shortId = feature.osmMeta?.id
    ? `${feature.osmMeta.type[0]}${feature.osmMeta.id}`
    : `custom-${Date.now()}`;
  const sizeBytes = await estimateTourSize(feature, track);
  const tour: SavedTour = {
    shortId,
    name: feature.tags?.name || 'Unbenannt',
    center: (feature.center as [number, number]) || [0, 0],
    difficulty:
      feature.tags?.['climbing:grade:via_ferrata'] ||
      feature.tags?.['via_ferrata:scale'] ||
      undefined,
    description: feature.tags?.description || feature.tags?.['description:de'],
    tags: feature.tags || {},
    track,
    savedAt: new Date().toISOString(),
    sizeBytes,
  };

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(tour);
    req.onsuccess = () => resolve(tour);
    req.onerror = () => reject(req.error);
  });
}

export async function getTour(shortId: string): Promise<SavedTour | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(shortId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllTours(): Promise<SavedTour[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTour(shortId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(shortId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getUsedSpace(): Promise<number> {
  const tours = await getAllTours();
  return tours.reduce((sum, t) => sum + (t.sizeBytes || 0), 0);
}

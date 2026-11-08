import { StoredTrack } from './types';

const tracks = new Map<string, StoredTrack>();

/** GPX tracks the user loaded in this tab. Not persisted until a tour is saved. */
export const rememberSessionTrack = (tourId: string, track: StoredTrack) => {
  tracks.set(tourId, track);
};

export const forgetSessionTrack = (tourId: string) => {
  tracks.delete(tourId);
};

export const readSessionTrack = (tourId: string): StoredTrack | null =>
  tracks.get(tourId) ?? null;

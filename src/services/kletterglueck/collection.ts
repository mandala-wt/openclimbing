import type { UserList } from '../my-lists/myListsTypes';
import { FAVORITES_ID, VISITED_ID } from '../my-lists/localFerrataLists';
import type { PersonalStore } from './personalData';
import { normalizeSearchText } from './tourSearch';

export type CollectionRow = {
  shortId: string;
  label: string;
  center: [number, number] | null;
  favorite: boolean;
  visited: boolean;
  note: string;
  visitedOn: string | null;
  stars: number | null;
  trackCount: number;
  /** Latest change we know of (added to a list or note saved). */
  changedAt: string;
};

export type CollectionFilter = 'all' | 'favorites' | 'visited' | 'notes';
export type CollectionSort = 'name' | 'changed' | 'visitedOn';

export const buildCollection = (
  lists: UserList[] | null,
  store: PersonalStore,
): CollectionRow[] => {
  const rows = new Map<string, CollectionRow>();
  const row = (shortId: string, label: string) => {
    let entry = rows.get(shortId);
    if (!entry) {
      entry = {
        shortId,
        label,
        center: null,
        favorite: false,
        visited: false,
        note: '',
        visitedOn: null,
        stars: null,
        trackCount: 0,
        changedAt: new Date(0).toISOString(),
      };
      rows.set(shortId, entry);
    }
    return entry;
  };
  const later = (a: string, b: string) => (a > b ? a : b);
  for (const list of lists ?? []) {
    if (list.id !== FAVORITES_ID && list.id !== VISITED_ID) continue;
    for (const item of list.items) {
      const entry = row(item.shortId, item.label);
      entry.center = entry.center ?? (item.center as [number, number]);
      if (list.id === FAVORITES_ID) entry.favorite = true;
      else entry.visited = true;
      entry.changedAt = later(entry.changedAt, item.addedAt);
    }
  }
  for (const saved of Object.values(store.entries)) {
    const entry = row(saved.shortId, saved.label);
    entry.note = saved.note;
    entry.visitedOn = saved.visitedOn;
    entry.stars = saved.stars ?? null;
    entry.changedAt = later(entry.changedAt, saved.updatedAt);
  }
  for (const track of store.tracks) {
    if (!track.shortId) continue;
    const entry = rows.get(track.shortId);
    if (entry) entry.trackCount += 1;
  }
  return [...rows.values()];
};

export const filterCollection = (
  rows: CollectionRow[],
  {
    query,
    filter,
    sort,
  }: { query: string; filter: CollectionFilter; sort: CollectionSort },
) => {
  const words = normalizeSearchText(query).split(' ').filter(Boolean);
  const matches = rows.filter((row) => {
    if (filter === 'favorites' && !row.favorite) return false;
    if (filter === 'visited' && !row.visited && !row.visitedOn) return false;
    if (filter === 'notes' && !row.note.trim()) return false;
    if (!words.length) return true;
    const text = normalizeSearchText(`${row.label} ${row.note}`);
    return words.every((word) => text.includes(word));
  });
  const byName = (a: CollectionRow, b: CollectionRow) =>
    a.label.localeCompare(b.label, 'de');
  return matches.sort((a, b) => {
    if (sort === 'changed')
      return b.changedAt.localeCompare(a.changedAt) || byName(a, b);
    if (sort === 'visitedOn') {
      // Tours without a date go last.
      if (a.visitedOn && b.visitedOn)
        return b.visitedOn.localeCompare(a.visitedOn);
      if (a.visitedOn || b.visitedOn) return a.visitedOn ? -1 : 1;
    }
    return byName(a, b);
  });
};

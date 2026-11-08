import {
  FAVORITES_ID,
  INITIAL_LOCAL_LISTS,
  VISITED_ID,
} from '../../my-lists/localFerrataLists';
import type { UserList } from '../../my-lists/myListsTypes';
import {
  EMPTY_PERSONAL_STORE,
  EXPORT_FORMAT,
  ImportError,
  addTrack,
  applyImportToStore,
  createExport,
  planHasChanges,
  planImport,
  readPersonalStore,
  upsertEntry,
  validateImport,
} from '../personalData';

const NOW = new Date('2026-11-08T10:00:00Z');
const segments: [number, number][][] = [
  [
    [11.5, 49.5],
    [11.501, 49.501],
  ],
];
const item = (shortId: string) => ({
  shortId,
  label: shortId,
  poiType: 'Klettersteig',
  center: [11, 49] as [number, number],
  addedAt: NOW.toISOString(),
});

const listsWith = (favorites: string[]): UserList[] =>
  INITIAL_LOCAL_LISTS.map((list) =>
    list.id === FAVORITES_ID
      ? { ...list, items: favorites.map(item) }
      : { ...list, items: [] },
  );

describe('personal entries', () => {
  it('stores notes and dates and removes empty entries', () => {
    let store = upsertEntry(
      EMPTY_PERSONAL_STORE,
      { shortId: 'w1', label: 'A', note: 'Schön', visitedOn: '2026-07-01' },
      NOW,
    );
    expect(store.entries.w1).toMatchObject({
      note: 'Schön',
      visitedOn: '2026-07-01',
      updatedAt: NOW.toISOString(),
    });
    store = upsertEntry(store, {
      shortId: 'w1',
      label: 'A',
      note: '  ',
      visitedOn: null,
    });
    expect(store.entries.w1).toBeUndefined();
  });

  it('rejects invalid dates and ids', () => {
    expect(() =>
      upsertEntry(EMPTY_PERSONAL_STORE, {
        shortId: 'w1',
        label: 'A',
        note: '',
        visitedOn: '2026-02-30',
      }),
    ).toThrow('gültiges Datum');
    expect(() =>
      upsertEntry(EMPTY_PERSONAL_STORE, {
        shortId: 'x1',
        label: 'A',
        note: 'a',
        visitedOn: null,
      }),
    ).toThrow('Ungültige Tour');
  });

  it('recovers from broken storage', () => {
    expect(readPersonalStore('{oops')).toBe(EMPTY_PERSONAL_STORE);
    expect(readPersonalStore(null)).toBe(EMPTY_PERSONAL_STORE);
  });
});

describe('tracks', () => {
  it('detects the same track, also when reversed', () => {
    const first = addTrack(
      EMPTY_PERSONAL_STORE,
      {
        name: 'A',
        shortId: null,
        fileName: 'a.gpx',
        segments,
        lengthM: 130,
        pointCount: 2,
      },
      NOW,
    );
    expect(first.added).toBe(true);
    const reversed = addTrack(first.store, {
      name: 'B',
      shortId: null,
      fileName: 'b.gpx',
      segments: [[...segments[0]].reverse()],
      lengthM: 130,
      pointCount: 2,
    });
    expect(reversed.added).toBe(false);
    expect(reversed.duplicateOf?.name).toBe('A');
  });
});

describe('export and import', () => {
  const exportFrom = (lists: UserList[], store = EMPTY_PERSONAL_STORE) =>
    JSON.stringify(createExport(lists, store, NOW));

  it('round-trips without changes into the same data', () => {
    const store = upsertEntry(
      EMPTY_PERSONAL_STORE,
      { shortId: 'w1', label: 'A', note: 'n', visitedOn: null },
      NOW,
    );
    const lists = listsWith(['w1']);
    const plan = planImport(
      lists,
      store,
      validateImport(exportFrom(lists, store)),
    );
    expect(planHasChanges(plan)).toBe(false);
    expect(plan.sameEntries).toBe(1);
    expect(plan.duplicateListItems).toBe(1);
  });

  it('adds only missing items and reports conflicts instead of overwriting', () => {
    const incomingStore = upsertEntry(
      upsertEntry(
        EMPTY_PERSONAL_STORE,
        { shortId: 'w1', label: 'A', note: 'neu', visitedOn: '2026-06-01' },
        NOW,
      ),
      { shortId: 'w2', label: 'B', note: 'zweite', visitedOn: null },
      NOW,
    );
    const file = exportFrom(listsWith(['w1', 'w2']), incomingStore);
    const currentStore = upsertEntry(
      EMPTY_PERSONAL_STORE,
      { shortId: 'w1', label: 'A', note: 'alt', visitedOn: null },
      NOW,
    );
    const plan = planImport(
      listsWith(['w1']),
      currentStore,
      validateImport(file),
    );
    expect(plan.newFavorites.map((i) => i.shortId)).toEqual(['w2']);
    expect(plan.newEntries.map((e) => e.shortId)).toEqual(['w2']);
    expect(plan.conflicts).toHaveLength(1);

    const kept = applyImportToStore(currentStore, plan, 'keep', NOW);
    expect(kept.entries.w1.note).toBe('alt');
    expect(kept.entries.w2.note).toBe('zweite');
    const replaced = applyImportToStore(currentStore, plan, 'replace', NOW);
    expect(replaced.entries.w1).toMatchObject({
      note: 'neu',
      visitedOn: '2026-06-01',
    });
  });

  it('skips invalid entries and duplicate tracks', () => {
    const file = JSON.stringify({
      format: EXPORT_FORMAT,
      version: 1,
      lists: [
        {
          kind: 'visited',
          name: 'x',
          items: [item('w5'), { shortId: 'bad', center: [0, 0] }, item('w5')],
        },
        { kind: 'custom', name: '', items: [] },
      ],
      entries: [{ shortId: 'w6', note: 'ok', visitedOn: '2026-13-01' }],
      tracks: [
        { name: 'T', segments },
        { name: 'T2', segments: [[[1, 2]]] },
      ],
    });
    const validated = validateImport(file);
    expect(validated.invalid).toBe(4);
    const existing = addTrack(EMPTY_PERSONAL_STORE, {
      name: 'old',
      shortId: null,
      fileName: null,
      segments,
      lengthM: 1,
      pointCount: 2,
    }).store;
    const plan = planImport(listsWith([]), existing, validated);
    expect(plan.newVisited.map((i) => i.shortId)).toEqual(['w5']);
    expect(plan.duplicateTracks).toBe(1);
    expect(plan.newTracks).toHaveLength(0);
    expect(INITIAL_LOCAL_LISTS.some(({ id }) => id === VISITED_ID)).toBe(true);
  });

  it.each([
    ['', 'leer'],
    ['not json', 'kein gültiges JSON'],
    ['{"format":"other"}', 'nicht aus dem Kletterglück-Export'],
    [`{"format":"${EXPORT_FORMAT}","version":2}`, 'Exportversion 2'],
  ])('rejects %j', (raw, message) => {
    expect(() => validateImport(raw)).toThrow(ImportError);
    expect(() => validateImport(raw)).toThrow(message);
  });
});

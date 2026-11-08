import {
  INITIAL_LOCAL_LISTS,
  FAVORITES_ID,
} from '../../my-lists/localFerrataLists';
import { EMPTY_PERSONAL_STORE, upsertEntry } from '../personalData';
import { buildCollection, filterCollection } from '../collection';

const lists = INITIAL_LOCAL_LISTS.map((list) =>
  list.id === FAVORITES_ID
    ? {
        ...list,
        items: [
          {
            shortId: 'w1',
            label: 'Zugspitzsteig',
            poiType: 'Klettersteig',
            center: [11, 47] as [number, number],
            addedAt: '2026-01-01T00:00:00Z',
          },
        ],
      }
    : list,
);
const store = upsertEntry(
  upsertEntry(
    EMPTY_PERSONAL_STORE,
    {
      shortId: 'w1156787758',
      label: 'Norissteig',
      note: 'Mit Mama, sehr schön',
      visitedOn: '2026-07-01',
      stars: 5,
    },
    new Date('2026-07-02T00:00:00Z'),
  ),
  {
    shortId: 'w2',
    label: 'Alpspitze',
    note: '',
    visitedOn: '2025-08-01',
    stars: null,
  },
  new Date('2025-08-02T00:00:00Z'),
);

test('merges list items and notes into one row per tour', () => {
  const rows = buildCollection(lists, store);
  const noris = rows.find((row) => row.shortId === 'w1156787758');
  expect(noris).toMatchObject({
    visited: true,
    note: 'Mit Mama, sehr schön',
    stars: 5,
  });
  expect(rows.find((row) => row.shortId === 'w1')).toMatchObject({
    favorite: true,
    visited: false,
  });
  expect(new Set(rows.map((row) => row.shortId)).size).toBe(rows.length);
});

test('searches label and note, filters and sorts', () => {
  const rows = buildCollection(lists, store);
  expect(
    filterCollection(rows, { query: 'mama', filter: 'all', sort: 'name' }).map(
      (r) => r.label,
    ),
  ).toEqual(['Norissteig']);
  expect(
    filterCollection(rows, {
      query: '',
      filter: 'favorites',
      sort: 'name',
    }).map((r) => r.label),
  ).toEqual(['Zugspitzsteig']);
  expect(
    filterCollection(rows, { query: '', filter: 'notes', sort: 'name' }),
  ).toHaveLength(1);
  const byVisit = filterCollection(rows, {
    query: '',
    filter: 'all',
    sort: 'visitedOn',
  }).map((r) => r.label);
  expect(byVisit.slice(0, 2)).toEqual(['Norissteig', 'Alpspitze']);
});

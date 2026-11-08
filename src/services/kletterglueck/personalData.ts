import type { UserList, UserListItem } from '../my-lists/myListsTypes';
import { FAVORITES_ID, VISITED_ID } from '../my-lists/localFerrataLists';
import type { TrackSegment } from './gpx';

/** Notes and visit date for one tour. Favourite/visited flags stay in the lists. */
export type PersonalEntry = {
  shortId: string;
  label: string;
  note: string;
  /** YYYY-MM-DD, optional */
  visitedOn: string | null;
  /** Own rating on this device, 1–5. */
  stars?: number | null;
  updatedAt: string;
};

export type PersonalTrack = {
  id: string;
  name: string;
  /** Tour this track was attached to, e.g. "w1156787758". */
  shortId: string | null;
  fileName: string | null;
  importedAt: string;
  segments: TrackSegment[];
  lengthM: number;
  pointCount: number;
};

export type PersonalStore = {
  version: 1;
  entries: Record<string, PersonalEntry>;
  tracks: PersonalTrack[];
};

export const PERSONAL_STORAGE_KEY = 'kletterglueck.personal.v1';
export const EMPTY_PERSONAL_STORE: PersonalStore = {
  version: 1,
  entries: {},
  tracks: [],
};

export const MAX_NOTE_LENGTH = 2000;
export const MAX_IMPORT_BYTES = 8_000_000;
/** localStorage is usually limited to ~5 MB per site; leave room for the rest. */
export const MAX_STORED_TRACK_POINTS = 60_000;

const SHORT_ID = /^[nwr][1-9]\d{0,17}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

export const isValidShortId = (value: unknown): value is string =>
  typeof value === 'string' && SHORT_ID.test(value);

const isEmptyEntry = (
  entry: Pick<PersonalEntry, 'note' | 'visitedOn' | 'stars'>,
) => !entry.note.trim() && !entry.visitedOn && !entry.stars;

export const isValidStars = (value: unknown): value is number | null =>
  value == null ||
  (typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5);

/** Update notes/date. Empty values remove the entry so nothing lingers. */
export const upsertEntry = (
  store: PersonalStore,
  entry: Omit<PersonalEntry, 'updatedAt'>,
  now = new Date(),
): PersonalStore => {
  if (!isValidShortId(entry.shortId)) throw new Error('Ungültige Tour.');
  if (entry.note.length > MAX_NOTE_LENGTH) {
    throw new Error(`Die Notiz ist länger als ${MAX_NOTE_LENGTH} Zeichen.`);
  }
  if (entry.visitedOn !== null && !isValidDate(entry.visitedOn)) {
    throw new Error('Bitte ein gültiges Datum wählen.');
  }
  if (!isValidStars(entry.stars)) {
    throw new Error('Bewertung muss zwischen 1 und 5 Sternen liegen.');
  }
  const entries = { ...store.entries };
  if (isEmptyEntry(entry)) {
    delete entries[entry.shortId];
  } else {
    entries[entry.shortId] = {
      ...entry,
      stars: entry.stars ?? null,
      updatedAt: now.toISOString(),
    };
  }
  return { ...store, entries };
};

const roundPoint = ([lon, lat]: [number, number]): [number, number] => [
  Math.round(lon * 1e6) / 1e6,
  Math.round(lat * 1e6) / 1e6,
];

/** Same points and segment boundaries (also reversed) mean the same track. */
export const trackFingerprint = (segments: TrackSegment[]) => {
  const forward = JSON.stringify(
    segments.map((segment) => segment.map(roundPoint)),
  );
  const reverse = JSON.stringify(
    segments
      .slice()
      .reverse()
      .map((segment) => segment.slice().reverse().map(roundPoint)),
  );
  return forward < reverse ? forward : reverse;
};

export const storedPointCount = (store: PersonalStore) =>
  store.tracks.reduce((sum, track) => sum + track.pointCount, 0);

export const addTrack = (
  store: PersonalStore,
  track: Omit<PersonalTrack, 'id' | 'importedAt'>,
  now = new Date(),
): { store: PersonalStore; added: boolean; duplicateOf?: PersonalTrack } => {
  const fingerprint = trackFingerprint(track.segments);
  const duplicateOf = store.tracks.find(
    (existing) => trackFingerprint(existing.segments) === fingerprint,
  );
  if (duplicateOf) return { store, added: false, duplicateOf };
  if (storedPointCount(store) + track.pointCount > MAX_STORED_TRACK_POINTS) {
    throw new Error(
      'Auf diesem Gerät ist nicht genug Platz für weitere Tracks. Bitte zuerst einen gespeicherten Track entfernen.',
    );
  }
  const id = `t${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    store: {
      ...store,
      tracks: [
        ...store.tracks,
        {
          ...track,
          segments: track.segments.map((segment) => segment.map(roundPoint)),
          id,
          importedAt: now.toISOString(),
        },
      ],
    },
    added: true,
  };
};

export const removeTrack = (
  store: PersonalStore,
  id: string,
): PersonalStore => ({
  ...store,
  tracks: store.tracks.filter((track) => track.id !== id),
});

/* ------------------------------------------------------------------------ */
/* Export / import                                                            */
/* ------------------------------------------------------------------------ */

export const EXPORT_FORMAT = 'kletterglueck-persoenliche-daten';

export type ExportedList = {
  name: string;
  emoji: string;
  color: string;
  kind: 'favorites' | 'visited' | 'custom';
  items: UserListItem[];
};

export type PersonalExport = {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  lists: ExportedList[];
  entries: PersonalEntry[];
  tracks: PersonalTrack[];
};

const kindOf = (list: UserList): ExportedList['kind'] =>
  list.id === FAVORITES_ID
    ? 'favorites'
    : list.id === VISITED_ID
      ? 'visited'
      : 'custom';

export const createExport = (
  lists: UserList[],
  store: PersonalStore,
  now = new Date(),
): PersonalExport => ({
  format: EXPORT_FORMAT,
  version: 1,
  exportedAt: now.toISOString(),
  lists: lists.map((list) => ({
    name: list.name,
    emoji: list.emoji,
    color: list.color,
    kind: kindOf(list),
    items: list.items,
  })),
  entries: Object.values(store.entries),
  tracks: store.tracks,
});

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

type Validated = {
  data: PersonalExport;
  /** Number of entries dropped because they were invalid. */
  invalid: number;
};

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : '';

const validItem = (value: unknown): UserListItem | null => {
  const item = value as UserListItem;
  if (!item || !isValidShortId(item.shortId)) return null;
  const center = Array.isArray(item.center) ? item.center : null;
  if (
    !center ||
    center.length !== 2 ||
    !center.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    Math.abs(center[0]) > 180 ||
    Math.abs(center[1]) > 90
  ) {
    return null;
  }
  return {
    shortId: item.shortId,
    label: text(item.label, 200) || item.shortId,
    poiType: text(item.poiType, 80) || 'Klettersteig',
    center: [center[0], center[1]],
    addedAt:
      typeof item.addedAt === 'string' &&
      Number.isFinite(Date.parse(item.addedAt))
        ? item.addedAt
        : new Date(0).toISOString(),
  };
};

const validTrack = (value: unknown): PersonalTrack | null => {
  const track = value as PersonalTrack;
  if (!track || !Array.isArray(track.segments) || !track.segments.length) {
    return null;
  }
  let pointCount = 0;
  for (const segment of track.segments) {
    if (!Array.isArray(segment) || segment.length < 2) return null;
    for (const point of segment) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1]) ||
        Math.abs(point[0]) > 180 ||
        Math.abs(point[1]) > 90
      ) {
        return null;
      }
    }
    pointCount += segment.length;
  }
  return {
    id: text(track.id, 40) || `import-${pointCount}`,
    name: text(track.name, 120) || 'Importierter Track',
    shortId: isValidShortId(track.shortId) ? track.shortId : null,
    fileName: text(track.fileName, 200) || null,
    importedAt:
      typeof track.importedAt === 'string' &&
      Number.isFinite(Date.parse(track.importedAt))
        ? track.importedAt
        : new Date(0).toISOString(),
    segments: track.segments,
    lengthM: Number.isFinite(track.lengthM) ? Math.max(0, track.lengthM) : 0,
    pointCount,
  };
};

export const validateImport = (raw: string): Validated => {
  if (!raw.trim()) throw new ImportError('Die Datei ist leer.');
  if (raw.length > MAX_IMPORT_BYTES) {
    throw new ImportError('Die Datei ist zu groß (mehr als 8 MB).');
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ImportError(
      'Die Datei ist kein gültiges JSON. Bitte eine Exportdatei von Kletterglück wählen.',
    );
  }
  const data = json as Partial<PersonalExport>;
  if (!data || typeof data !== 'object' || data.format !== EXPORT_FORMAT) {
    throw new ImportError(
      'Diese Datei stammt nicht aus dem Kletterglück-Export.',
    );
  }
  if (data.version !== 1) {
    throw new ImportError(
      `Die Exportversion ${String(data.version)} wird nicht unterstützt.`,
    );
  }
  let invalid = 0;
  const lists: ExportedList[] = [];
  for (const list of Array.isArray(data.lists) ? data.lists : []) {
    if (!list || !['favorites', 'visited', 'custom'].includes(list.kind)) {
      invalid += 1;
      continue;
    }
    const items: UserListItem[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(list.items) ? list.items : []) {
      const item = validItem(raw);
      if (!item) invalid += 1;
      else if (!seen.has(item.shortId)) {
        seen.add(item.shortId);
        items.push(item);
      }
    }
    const name = text(list.name, 80).trim();
    if (list.kind === 'custom' && !name) {
      invalid += 1;
      continue;
    }
    lists.push({
      kind: list.kind,
      name,
      emoji: text(list.emoji, 8),
      color: /^#[0-9a-f]{6}$/i.test(list.color) ? list.color : '#cccccc',
      items,
    });
  }
  const entries: PersonalEntry[] = [];
  for (const raw of Array.isArray(data.entries) ? data.entries : []) {
    const entry = raw as PersonalEntry;
    if (
      !entry ||
      !isValidShortId(entry.shortId) ||
      typeof entry.note !== 'string' ||
      entry.note.length > MAX_NOTE_LENGTH ||
      (entry.visitedOn != null && !isValidDate(entry.visitedOn)) ||
      !isValidStars(entry.stars)
    ) {
      invalid += 1;
      continue;
    }
    entries.push({
      shortId: entry.shortId,
      label: text(entry.label, 200) || entry.shortId,
      note: entry.note,
      visitedOn: entry.visitedOn ?? null,
      stars: entry.stars ?? null,
      updatedAt:
        typeof entry.updatedAt === 'string' &&
        Number.isFinite(Date.parse(entry.updatedAt))
          ? entry.updatedAt
          : new Date(0).toISOString(),
    });
  }
  const tracks: PersonalTrack[] = [];
  for (const raw of Array.isArray(data.tracks) ? data.tracks : []) {
    const track = validTrack(raw);
    if (track) tracks.push(track);
    else invalid += 1;
  }
  return {
    data: {
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: text(data.exportedAt, 40),
      lists,
      entries,
      tracks,
    },
    invalid,
  };
};

export type ImportConflict = {
  shortId: string;
  label: string;
  current: Pick<PersonalEntry, 'note' | 'visitedOn' | 'stars'>;
  incoming: Pick<PersonalEntry, 'note' | 'visitedOn' | 'stars'>;
};

export type ImportPlan = {
  newFavorites: UserListItem[];
  newVisited: UserListItem[];
  /** Custom lists: items to add per list name (new lists are created). */
  customLists: {
    list: ExportedList;
    newItems: UserListItem[];
    exists: boolean;
  }[];
  newEntries: PersonalEntry[];
  sameEntries: number;
  conflicts: ImportConflict[];
  newTracks: PersonalTrack[];
  duplicateTracks: number;
  duplicateListItems: number;
  invalid: number;
};

const findList = (
  lists: UserList[],
  kind: ExportedList['kind'],
  name: string,
) =>
  kind === 'favorites'
    ? lists.find(({ id }) => id === FAVORITES_ID)
    : kind === 'visited'
      ? lists.find(({ id }) => id === VISITED_ID)
      : lists.find(
          (list) =>
            list.id !== FAVORITES_ID &&
            list.id !== VISITED_ID &&
            list.name.trim().toLocaleLowerCase('de') ===
              name.toLocaleLowerCase('de'),
        );

export const planImport = (
  lists: UserList[],
  store: PersonalStore,
  { data, invalid }: Validated,
): ImportPlan => {
  const plan: ImportPlan = {
    newFavorites: [],
    newVisited: [],
    customLists: [],
    newEntries: [],
    sameEntries: 0,
    conflicts: [],
    newTracks: [],
    duplicateTracks: 0,
    duplicateListItems: 0,
    invalid,
  };
  const merged = new Map<string, ExportedList>();
  for (const list of data.lists) {
    const key = `${list.kind}:${list.kind === 'custom' ? list.name.toLocaleLowerCase('de') : ''}`;
    const previous = merged.get(key);
    if (!previous) merged.set(key, { ...list, items: [...list.items] });
    else {
      for (const item of list.items) {
        if (previous.items.some(({ shortId }) => shortId === item.shortId)) {
          plan.duplicateListItems += 1;
        } else previous.items.push(item);
      }
    }
  }
  for (const list of merged.values()) {
    const existing = findList(lists, list.kind, list.name);
    const known = new Set(existing?.items.map(({ shortId }) => shortId));
    const newItems = list.items.filter((item) => !known.has(item.shortId));
    plan.duplicateListItems += list.items.length - newItems.length;
    if (list.kind === 'favorites') plan.newFavorites.push(...newItems);
    else if (list.kind === 'visited') plan.newVisited.push(...newItems);
    else if (newItems.length || !existing) {
      plan.customLists.push({ list, newItems, exists: Boolean(existing) });
    }
  }
  const seenEntries = new Set<string>();
  for (const entry of data.entries) {
    if (seenEntries.has(entry.shortId)) continue;
    seenEntries.add(entry.shortId);
    const current = store.entries[entry.shortId];
    if (!current) plan.newEntries.push(entry);
    else if (
      current.note === entry.note &&
      (current.visitedOn ?? null) === (entry.visitedOn ?? null) &&
      (current.stars ?? null) === (entry.stars ?? null)
    ) {
      plan.sameEntries += 1;
    } else {
      plan.conflicts.push({
        shortId: entry.shortId,
        label: current.label || entry.label,
        current: {
          note: current.note,
          visitedOn: current.visitedOn,
          stars: current.stars ?? null,
        },
        incoming: {
          note: entry.note,
          visitedOn: entry.visitedOn,
          stars: entry.stars ?? null,
        },
      });
    }
  }
  const fingerprints = new Set(
    store.tracks.map((track) => trackFingerprint(track.segments)),
  );
  for (const track of data.tracks) {
    const fingerprint = trackFingerprint(track.segments);
    if (fingerprints.has(fingerprint)) plan.duplicateTracks += 1;
    else {
      fingerprints.add(fingerprint);
      plan.newTracks.push(track);
    }
  }
  return plan;
};

export const planHasChanges = (plan: ImportPlan) =>
  plan.newFavorites.length > 0 ||
  plan.newVisited.length > 0 ||
  plan.customLists.length > 0 ||
  plan.newEntries.length > 0 ||
  plan.conflicts.length > 0 ||
  plan.newTracks.length > 0;

export type ConflictChoice = 'keep' | 'replace';

/** Applies the plan. Existing notes are only replaced when asked to. */
export const applyImportToStore = (
  store: PersonalStore,
  plan: ImportPlan,
  conflictChoice: ConflictChoice,
  now = new Date(),
): PersonalStore => {
  const entries = { ...store.entries };
  for (const entry of plan.newEntries) entries[entry.shortId] = entry;
  if (conflictChoice === 'replace') {
    for (const conflict of plan.conflicts) {
      entries[conflict.shortId] = {
        ...entries[conflict.shortId],
        ...conflict.incoming,
        updatedAt: now.toISOString(),
      };
    }
  }
  const pointsBefore = storedPointCount(store);
  const room = MAX_STORED_TRACK_POINTS - pointsBefore;
  const tracks = [...store.tracks];
  let used = 0;
  for (const track of plan.newTracks) {
    if (used + track.pointCount > room) {
      throw new ImportError(
        'Die Tracks passen nicht in den Gerätespeicher. Bitte zuerst Tracks entfernen.',
      );
    }
    used += track.pointCount;
    const id = tracks.some(({ id }) => id === track.id)
      ? `${track.id}-${now.getTime().toString(36)}`
      : track.id;
    tracks.push({ ...track, id });
  }
  return { ...store, entries, tracks };
};

export const readPersonalStore = (raw: string | null): PersonalStore => {
  if (!raw) return EMPTY_PERSONAL_STORE;
  try {
    const value = JSON.parse(raw) as PersonalStore;
    if (value?.version !== 1 || typeof value.entries !== 'object') {
      return EMPTY_PERSONAL_STORE;
    }
    return {
      version: 1,
      entries: value.entries ?? {},
      tracks: Array.isArray(value.tracks) ? value.tracks : [],
    };
  } catch {
    return EMPTY_PERSONAL_STORE;
  }
};

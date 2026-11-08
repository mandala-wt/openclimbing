import { quotaProblem, usedBytes } from './limits';
import { TourPack } from './types';

export type TourRepository = {
  list: () => Promise<TourPack[]>;
  get: (id: string) => Promise<TourPack | null>;
  put: (pack: TourPack) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

export class QuotaError extends Error {
  readonly problem: 'count' | 'bytes';

  constructor(problem: 'count' | 'bytes') {
    super(problem === 'count' ? 'too many tours' : 'too many bytes');
    this.name = 'QuotaError';
    this.problem = problem;
  }
}

export const createMemoryRepository = (
  initial: TourPack[] = [],
): TourRepository => {
  const packs = new Map(initial.map((pack) => [pack.id, pack]));
  return {
    list: async () =>
      [...packs.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    get: async (id) => packs.get(id) ?? null,
    put: async (pack) => {
      const problem = quotaProblem([...packs.values()], pack);
      if (problem) throw new QuotaError(problem);
      packs.set(pack.id, pack);
    },
    delete: async (id) => {
      packs.delete(id);
    },
  };
};

export const repositoryBytes = async (
  repository: TourRepository,
): Promise<number> => usedBytes(await repository.list());

const DB_NAME = 'kletterglueck-offline';
const STORE = 'tours';
const DB_VERSION = 1;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const openOfflineDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

export const createIndexedDbRepository = (): TourRepository => ({
  list: async () => {
    const db = await openOfflineDatabase();
    const transaction = db.transaction(STORE, 'readonly');
    const packs = await requestToPromise(
      transaction.objectStore(STORE).getAll() as IDBRequest<TourPack[]>,
    );
    return packs.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  },
  get: async (id) => {
    const db = await openOfflineDatabase();
    const transaction = db.transaction(STORE, 'readonly');
    const pack = await requestToPromise(
      transaction.objectStore(STORE).get(id) as IDBRequest<
        TourPack | undefined
      >,
    );
    return pack ?? null;
  },
  put: async (pack) => {
    const existing = await createIndexedDbRepository().list();
    const problem = quotaProblem(existing, pack);
    if (problem) throw new QuotaError(problem);
    const db = await openOfflineDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(pack);
    await transactionDone(transaction);
  },
  delete: async (id) => {
    const db = await openOfflineDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    await transactionDone(transaction);
  },
});

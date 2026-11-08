import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EMPTY_PERSONAL_STORE,
  PERSONAL_STORAGE_KEY,
  PersonalStore,
  readPersonalStore,
} from '../../services/kletterglueck/personalData';

type PersonalDataContextType = {
  store: PersonalStore;
  /** False until localStorage was read (avoids SSR hydration mismatches). */
  ready: boolean;
  /** Throws when the device refuses to store the data (quota, private mode). */
  update: (change: (current: PersonalStore) => PersonalStore) => PersonalStore;
};

const PersonalDataContext = createContext<PersonalDataContextType | undefined>(
  undefined,
);

const readStorage = () => {
  try {
    return readPersonalStore(window.localStorage.getItem(PERSONAL_STORAGE_KEY));
  } catch {
    return EMPTY_PERSONAL_STORE;
  }
};

export const writePersonalStorage = (store: PersonalStore) => {
  try {
    window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error(
      'Speichern auf diesem Gerät ist fehlgeschlagen (Speicher voll oder privater Modus).',
    );
  }
};

export const PersonalDataProvider: React.FC = ({ children }) => {
  const [store, setStore] = useState<PersonalStore>(EMPTY_PERSONAL_STORE);
  const [ready, setReady] = useState(false);
  const latest = useRef(store);

  useEffect(() => {
    const initial = readStorage();
    latest.current = initial;
    setStore(initial);
    setReady(true);
    // Another tab on the same device changed the data.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PERSONAL_STORAGE_KEY) return;
      const next = readPersonalStore(event.newValue);
      latest.current = next;
      setStore(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback(
    (change: (current: PersonalStore) => PersonalStore) => {
      const next = change(latest.current);
      if (next === latest.current) return next;
      writePersonalStorage(next);
      latest.current = next;
      setStore(next);
      return next;
    },
    [],
  );

  const value = useMemo(
    () => ({ store, ready, update }),
    [store, ready, update],
  );
  return (
    <PersonalDataContext.Provider value={value}>
      {children}
    </PersonalDataContext.Provider>
  );
};

export const usePersonalData = () => {
  const context = useContext(PersonalDataContext);
  if (!context) {
    throw new Error('usePersonalData must be used within PersonalDataProvider');
  }
  return context;
};

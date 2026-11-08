import React from 'react';

// Runtime is React 19; @types/react stays on 17 (see package.json), which
// does not declare useSyncExternalStore yet.
export const useSyncExternalStore = (
  React as unknown as {
    useSyncExternalStore: <T>(
      subscribe: (onStoreChange: () => void) => () => void,
      getSnapshot: () => T,
      getServerSnapshot?: () => T,
    ) => T;
  }
).useSyncExternalStore;

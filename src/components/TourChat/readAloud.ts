import React from 'react';

// Runtime is React 19 (has useSyncExternalStore). @types/react stays on 17
// because React.FC there still includes children, which this codebase relies on.
const useSyncExternalStore = (
  React as unknown as {
    useSyncExternalStore: <T>(
      subscribe: (onStoreChange: () => void) => () => void,
      getSnapshot: () => T,
      getServerSnapshot?: () => T,
    ) => T;
  }
).useSyncExternalStore;

export type ReadAloudPhase = 'idle' | 'loading' | 'playing';

export type ReadAloudState = {
  messageId: string | null;
  phase: ReadAloudPhase;
  error: string;
};

const idle: ReadAloudState = { messageId: null, phase: 'idle', error: '' };
let state: ReadAloudState = idle;
let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let playGeneration = 0;
const listeners = new Set<() => void>();

const publish = (next: ReadAloudState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const releaseUrl = () => {
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  objectUrl = null;
};

export const stopReadAloud = () => {
  playGeneration += 1;
  audio?.pause();
  audio = null;
  releaseUrl();
  publish(idle);
};

const playBlob = async (blob: Blob, generation: number) => {
  releaseUrl();
  const url = URL.createObjectURL(blob);
  objectUrl = url;
  const next = new Audio(url);
  audio = next;
  next.addEventListener('ended', () => {
    if (audio !== next) return;
    releaseUrl();
    audio = null;
    publish(idle);
  });
  publish({ ...state, phase: 'playing', error: '' });
  await next.play();
  if (generation !== playGeneration) next.pause();
};

export const startReadAloud = async (messageId: string, text: string) => {
  stopReadAloud();
  const generation = playGeneration;
  publish({ messageId, phase: 'loading', error: '' });
  try {
    const response = await fetch('/api/kletterglueck/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: 'eve', language: 'de' }),
    });
    if (generation !== playGeneration) return;
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error || 'Vorlesen gerade nicht möglich.');
    }
    await playBlob(await response.blob(), generation);
  } catch (failure) {
    if (generation !== playGeneration) return;
    audio?.pause();
    audio = null;
    releaseUrl();
    publish({
      messageId: null,
      phase: 'idle',
      error:
        failure instanceof Error
          ? failure.message
          : 'Vorlesen gerade nicht möglich.',
    });
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useReadAloud = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => idle,
  );

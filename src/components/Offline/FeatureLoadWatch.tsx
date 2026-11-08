import { useEffect } from 'react';
import { useFeatureContext } from '../utils/FeatureContext';

const GIVE_UP_MS = 20_000;

/** A feature request that never settles must not spin forever. */
export const FeatureLoadWatch = () => {
  const { feature, setFeature } = useFeatureContext();
  const waiting = Boolean(feature?.skeleton && !feature.error);
  const key = feature
    ? `${feature.osmMeta?.type ?? ''}/${feature.osmMeta?.id ?? ''}`
    : '';

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = window.setTimeout(() => {
      setFeature((current) =>
        current?.skeleton && !current.error
          ? { ...current, error: 'network' }
          : current,
      );
    }, GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [waiting, key, setFeature]);

  return null;
};

import { Alert, Button, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { createIndexedDbRepository } from '../../services/offline/repository';
import { TourPack } from '../../services/offline/types';
import { Feature } from '../../services/types';
import { PanelSidePadding } from '../utils/PanelHelpers';

const messageFor = (feature: Feature): string => {
  if (feature.error === '404') {
    return 'OpenStreetMap kennt dieses Objekt nicht.';
  }
  if (feature.error === 'network') {
    return 'Die Tour konnte nicht geladen werden. Ohne Netz gibt es nur Touren, die vorher für unterwegs gespeichert wurden.';
  }
  return 'Die Tour konnte nicht geladen werden. Die Anfrage ist fehlgeschlagen, es wird nichts mehr nachgeladen.';
};

export const OfflineFeatureFallback = ({ feature }: { feature: Feature }) => {
  const [pack, setPack] = useState<TourPack | null | 'unknown'>('unknown');
  const id =
    feature.osmMeta?.type && feature.osmMeta.id
      ? `${feature.osmMeta.type}/${feature.osmMeta.id}`
      : null;

  useEffect(() => {
    if (!id) {
      setPack(null);
      return undefined;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      if (live) setPack((current) => (current === 'unknown' ? null : current));
    }, 3000);
    createIndexedDbRepository()
      .get(id)
      .then((stored) => {
        if (live) setPack(stored);
      })
      .catch(() => {
        if (live) setPack(null);
      });
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  return (
    <PanelSidePadding>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Alert severity="warning">{messageFor(feature)}</Alert>
        {pack && pack !== 'unknown' && (
          <>
            <Typography>
              Gespeicherte Kopie von {pack.savedAt}: {pack.name}. Das ist nicht
              der aktuelle OSM-Stand.
            </Typography>
            <Button
              variant="contained"
              href={`/unterwegs.html?tour=${encodeURIComponent(pack.id)}`}
              sx={{ minHeight: 56 }}
            >
              Gespeicherte Tour öffnen
            </Button>
          </>
        )}
        {pack === null && (
          <Typography>
            Für dieses Objekt liegt keine gespeicherte Tour auf dem Gerät.
          </Typography>
        )}
      </Stack>
    </PanelSidePadding>
  );
};

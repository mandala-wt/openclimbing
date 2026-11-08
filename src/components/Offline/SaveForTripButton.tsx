import DownloadForOfflineIcon from '@mui/icons-material/DownloadForOffline';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { formatBytes } from '../../services/offline/limits';
import {
  loadOsmTracks,
  OsmTrackError,
} from '../../services/offline/loadOsmTracks';
import { buildTourPack } from '../../services/offline/pack';
import {
  createIndexedDbRepository,
  QuotaError,
  repositoryBytes,
} from '../../services/offline/repository';
import { readSessionTrack } from '../../services/offline/sessionTracks';
import { StoredTrack, TourPack } from '../../services/offline/types';
import { useFeatureContext } from '../utils/FeatureContext';
import { QuickActionButton } from '../FeaturePanel/QuickActions/QuickActionButton';

type Draft = {
  pack: TourPack;
  warning: string | null;
};

const prepareDraft = async (
  osmType: 'node' | 'way' | 'relation',
  osmId: number,
  tags: Record<string, string>,
  lon: number | null,
  lat: number | null,
  osmTimestamp: string | null,
): Promise<Draft> => {
  const id = `${osmType}/${osmId}`;
  const readAt = new Date().toISOString();
  let tracks: StoredTrack[] = [];
  let warning: string | null = null;
  let timestamp = osmTimestamp;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    warning =
      'Kein Netz. Die OpenStreetMap-Linie wird nicht neu gelesen. Gespeichert werden nur Angaben, die schon in dieser Ansicht sind.';
  } else if (osmType !== 'node') {
    try {
      const loaded = await loadOsmTracks(osmType, osmId, readAt);
      tracks = loaded.tracks;
      timestamp = loaded.osmTimestamp ?? timestamp;
      if (tracks.length === 0) {
        warning =
          'OpenStreetMap hat keine zusammenhängende Linie geliefert. Der Track fehlt in dieser Speicherung.';
      }
    } catch (error) {
      warning =
        error instanceof OsmTrackError
          ? error.message
          : 'Die Linie konnte nicht gelesen werden. Es ist noch nichts gespeichert.';
    }
  }
  const session = readSessionTrack(id);
  if (session && session.points.length >= 2) tracks = [...tracks, session];
  return {
    warning,
    pack: buildTourPack({
      osmType,
      osmId,
      tags,
      lon,
      lat,
      osmTimestamp: timestamp,
      tracks,
      savedAt: readAt,
    }),
  };
};

const DraftSummary = ({ draft }: { draft: Draft }) => {
  const { pack } = draft;
  return (
    <Stack spacing={1}>
      {draft.warning && <Alert severity="warning">{draft.warning}</Alert>}
      <Typography>
        {pack.nameFromOsm ? pack.name : 'Kein Name in OpenStreetMap'} ·{' '}
        {pack.id}
      </Typography>
      <Typography>
        Ungefährer Speicherbedarf: {formatBytes(pack.bytes)}. Kartenkacheln sind
        nicht enthalten.
      </Typography>
      <Typography variant="body2">{pack.mapTilesNote}</Typography>
      <Typography variant="body2">
        Schwierigkeit:{' '}
        {pack.difficulty.length
          ? pack.difficulty
              .map((pair) => `${pair.key}=${pair.value}`)
              .join(', ')
          : 'kein entsprechendes OSM-Merkmal'}
        . Beschreibung:{' '}
        {pack.description.length ? 'vorhanden' : 'kein description-Merkmal'}.
        Linien: {pack.tracks.length}. OSM-Stand:{' '}
        {pack.osmTimestamp ?? 'unbekannt'}.
      </Typography>
    </Stack>
  );
};

export const SaveForTripButton = () => {
  const { feature } = useFeatureContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState<string | null>(null);
  const osmType = feature?.osmMeta?.type;
  const osmId = feature?.osmMeta?.id;
  const canSave =
    !!feature &&
    !feature.point &&
    !feature.skeleton &&
    !feature.error &&
    (osmType === 'node' || osmType === 'way' || osmType === 'relation') &&
    typeof osmId === 'number';

  if (!canSave || !feature) return null;

  const openDialog = async () => {
    setOpen(true);
    setBusy(true);
    setError(null);
    setUsed(null);
    setDraft(null);
    try {
      const next = await prepareDraft(
        osmType,
        osmId,
        feature.tags ?? {},
        feature.center?.[0] ?? null,
        feature.center?.[1] ?? null,
        feature.osmMeta.timestamp ?? null,
      );
      setDraft(next);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Die Tour konnte nicht vorbereitet werden.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const repository = createIndexedDbRepository();
      await repository.put(draft.pack);
      const bytes = await repositoryBytes(repository);
      setUsed(formatBytes(bytes));
    } catch (failure) {
      setError(
        failure instanceof QuotaError
          ? 'Der Offline-Speicher ist voll. Lösche eine gespeicherte Tour.'
          : 'Speichern ist fehlgeschlagen. Es wurde nichts geändert.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <QuickActionButton
        icon={DownloadForOfflineIcon}
        label="Für unterwegs"
        onClick={() => void openDialog()}
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Für unterwegs speichern</DialogTitle>
        <DialogContent>
          {busy && !draft && (
            <Typography>Vorhandene Daten werden gelesen …</Typography>
          )}
          {draft && <DraftSummary draft={draft} />}
          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
          {used && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Gespeichert. Belegt durch Touren auf diesem Gerät: {used}. Das ist
              der Stand von eben, nicht live.
            </Alert>
          )}
          <Button
            href="/unterwegs.html"
            component="a"
            sx={{ mt: 2, minHeight: 48 }}
          >
            Gespeicherte Touren
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} sx={{ minHeight: 48 }}>
            Schließen
          </Button>
          <Button
            variant="contained"
            disabled={!draft || busy}
            onClick={() => void confirm()}
            sx={{ minHeight: 48 }}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

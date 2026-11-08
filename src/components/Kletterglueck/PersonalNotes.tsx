import {
  Alert,
  Box,
  Button,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { getShortId } from '../../services/helpers';
import { featureToItem } from '../../services/my-lists/featureToItem';
import {
  FAVORITES_ID,
  VISITED_ID,
} from '../../services/my-lists/localFerrataLists';
import {
  MAX_NOTE_LENGTH,
  upsertEntry,
} from '../../services/kletterglueck/personalData';
import type { Feature } from '../../services/types';
import { useMyListsContext } from '../utils/MyListsContext';
import { usePersonalData } from '../utils/PersonalDataContext';
import { getLabel } from '../../helpers/featureLabel';

const today = () => new Date().toISOString().slice(0, 10);

const ToggleButton = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Button
    aria-pressed={pressed}
    variant={pressed ? 'contained' : 'outlined'}
    onClick={onClick}
    sx={{ minHeight: 48, textTransform: 'none', fontWeight: 700, flex: 1 }}
  >
    {children}
  </Button>
);

/** Favourite, visited, visit date, stars and note – all on this device. */
export const PersonalNotes = ({ feature }: { feature: Feature }) => {
  const shortId = getShortId(feature.osmMeta);
  const { store, ready, update } = usePersonalData();
  const { listsContaining, addToList, removeFromList } = useMyListsContext();
  const saved = store.entries[shortId];
  const [note, setNote] = useState('');
  const [visitedOn, setVisitedOn] = useState('');
  const [stars, setStars] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // Load the stored values (again after reload or another tab saved).
  useEffect(() => {
    setNote(saved?.note ?? '');
    setVisitedOn(saved?.visitedOn ?? '');
    setStars(saved?.stars ?? null);
  }, [saved, shortId]);

  const containing = listsContaining(shortId);
  const favorite = containing.some(({ id }) => id === FAVORITES_ID);
  const visited = containing.some(({ id }) => id === VISITED_ID);
  const item = featureToItem(feature);
  const dirty =
    note !== (saved?.note ?? '') ||
    visitedOn !== (saved?.visitedOn ?? '') ||
    stars !== (saved?.stars ?? null);

  const save = async () => {
    try {
      update((current) =>
        upsertEntry(current, {
          shortId,
          label: getLabel(feature),
          note,
          visitedOn: visitedOn || null,
          stars,
        }),
      );
      if (visitedOn && !visited) await addToList(VISITED_ID, item);
      setStatus({ ok: true, text: 'Auf diesem Gerät gespeichert.' });
    } catch (error) {
      setStatus({
        ok: false,
        text:
          error instanceof Error ? error.message : 'Speichern fehlgeschlagen.',
      });
    }
  };

  return (
    <Stack sx={{ gap: 1.5 }} data-testid="personal-notes">
      <Stack direction="row" sx={{ gap: 1 }}>
        <ToggleButton
          pressed={favorite}
          onClick={() =>
            void (favorite
              ? removeFromList(FAVORITES_ID, shortId)
              : addToList(FAVORITES_ID, item))
          }
        >
          {favorite ? '⭐ Favorit' : '☆ Als Favorit merken'}
        </ToggleButton>
        <ToggleButton
          pressed={visited}
          onClick={() =>
            void (visited
              ? removeFromList(VISITED_ID, shortId)
              : addToList(VISITED_ID, item))
          }
        >
          {visited ? '😊 Besucht' : 'Als besucht markieren'}
        </ToggleButton>
      </Stack>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Meine Sterne
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Rating
            name={`stars-${shortId}`}
            value={stars}
            onChange={(_event, value) => setStars(value)}
            size="large"
            aria-label="Meine Sterne"
          />
          {stars && (
            <Button size="small" onClick={() => setStars(null)}>
              Entfernen
            </Button>
          )}
        </Stack>
      </Box>
      <TextField
        type="date"
        label="Besucht am (optional)"
        value={visitedOn}
        onChange={(event) => setVisitedOn(event.target.value)}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { max: today(), style: { fontSize: 16, minHeight: 28 } },
        }}
        helperText={
          visitedOn && !visited
            ? 'Beim Speichern wird die Tour auch als besucht markiert.'
            : undefined
        }
      />
      <TextField
        label="Notiz"
        multiline
        minRows={3}
        value={note}
        onChange={(event) =>
          setNote(event.target.value.slice(0, MAX_NOTE_LENGTH))
        }
        helperText={`${note.length} / ${MAX_NOTE_LENGTH} Zeichen`}
        slotProps={{ htmlInput: { style: { fontSize: 16 } } }}
      />
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={() => void save()}
          disabled={!ready || !dirty}
          sx={{ minHeight: 48, textTransform: 'none', fontWeight: 700 }}
        >
          Notiz speichern
        </Button>
        {dirty && (
          <Typography variant="body2" color="text.secondary">
            Nicht gespeicherte Änderungen
          </Typography>
        )}
      </Stack>
      {status && (
        <Alert
          severity={status.ok ? 'success' : 'error'}
          onClose={() => setStatus(null)}
          role="status"
        >
          {status.text}
        </Alert>
      )}
      <Typography variant="caption" color="text.secondary">
        Favoriten, Besuche, Sterne und Notizen liegen nur in diesem Browser auf
        diesem Gerät. Sie werden nicht zwischen Geräten abgeglichen. Für ein
        anderes Gerät unter „Meine Touren“ exportieren und dort importieren.
      </Typography>
    </Stack>
  );
};

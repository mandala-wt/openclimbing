import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import {
  GpxError,
  MAX_GPX_BYTES,
  ParsedGpx,
  parseGpx,
} from '../../services/kletterglueck/gpx';
import { addTrack } from '../../services/kletterglueck/personalData';
import { usePersonalData } from '../utils/PersonalDataContext';
import { formatAltitude, formatMetres } from './format';
import { fitBoundsOnMap } from './openTourOnMap';
import { readFileText } from './shareFile';
import { hideTrack, showTrack } from './trackOverlay';

const PREVIEW_ID = 'gpx-import-preview';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Tour the dialog was opened from, e.g. { shortId: 'w1', label: 'Norissteig' }. */
  tour?: { shortId: string; label: string } | null;
  onSaved?: (message: string) => void;
};

type State =
  | { step: 'choose'; error?: string }
  | { step: 'reading'; fileName: string }
  | { step: 'preview'; fileName: string; parsed: ParsedGpx };

const Fact = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
  </Box>
);

export const GpxImportDialog = ({ open, onClose, tour, onSaved }: Props) => {
  const { update } = usePersonalData();
  const [state, setState] = useState<State>({ step: 'choose' });
  const [name, setName] = useState('');
  const [attach, setAttach] = useState(true);
  const [saveError, setSaveError] = useState('');
  const readId = useRef(0);

  useEffect(() => {
    if (!open) {
      hideTrack(PREVIEW_ID);
      setState({ step: 'choose' });
      setSaveError('');
    }
  }, [open]);
  useEffect(() => () => hideTrack(PREVIEW_ID), []);

  const readFile = async (file: File) => {
    const id = ++readId.current;
    setSaveError('');
    setState({ step: 'reading', fileName: file.name });
    try {
      const parsed = parseGpx(await readFileText(file, MAX_GPX_BYTES));
      if (id !== readId.current) return; // a newer file was chosen
      setName(parsed.name || file.name.replace(/\.gpx$/i, ''));
      setState({ step: 'preview', fileName: file.name, parsed });
      showTrack({ id: PREVIEW_ID, kind: 'preview', segments: parsed.segments });
      fitBoundsOnMap(parsed.bounds);
    } catch (error) {
      if (id !== readId.current) return;
      hideTrack(PREVIEW_ID);
      setState({
        step: 'choose',
        error:
          error instanceof GpxError || error instanceof Error
            ? error.message
            : 'Die Datei konnte nicht gelesen werden.',
      });
    }
  };

  const save = () => {
    if (state.step !== 'preview') return;
    const { parsed, fileName } = state;
    try {
      let duplicate: string | undefined;
      update((current) => {
        const result = addTrack(current, {
          name: name.trim().slice(0, 120) || 'Importierter Track',
          shortId: attach && tour ? tour.shortId : null,
          fileName,
          segments: parsed.segments,
          lengthM: parsed.lengthM,
          pointCount: parsed.pointCount,
        });
        duplicate = result.duplicateOf?.name;
        return result.store;
      });
      if (duplicate) {
        setSaveError(
          `Dieser Track ist schon auf diesem Gerät gespeichert („${duplicate}“).`,
        );
        return;
      }
      hideTrack(PREVIEW_ID);
      onSaved?.(`Track „${name.trim() || 'Importierter Track'}“ gespeichert.`);
      onClose();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Speichern fehlgeschlagen.',
      );
    }
  };

  const parsed = state.step === 'preview' ? state.parsed : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      // keep the map preview visible above the dialog on phones
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-end' } }}
      slotProps={{
        paper: {
          sx: {
            m: 1,
            mb: 'calc(8px + env(safe-area-inset-bottom))',
            maxHeight: '62dvh',
          },
        },
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.15)' } },
      }}
    >
      <DialogTitle>GPX-Datei importieren</DialogTitle>
      <DialogContent>
        {state.step !== 'preview' && (
          <Stack sx={{ gap: 1.5 }}>
            <Typography variant="body2">
              Die Datei wird nur in diesem Browser gelesen. Gespeichert werden
              Koordinaten und der Name – keine Zeitstempel, Gerätenamen oder
              Autorenangaben. Der Track bleibt auf diesem Gerät.
            </Typography>
            <Button
              component="label"
              variant="contained"
              startIcon={<UploadFileIcon />}
              disabled={state.step === 'reading'}
              sx={{ minHeight: 48, textTransform: 'none' }}
            >
              {state.step === 'reading'
                ? `„${state.fileName}“ wird gelesen …`
                : 'Datei auswählen'}
              {/* No accept filter: iOS greys out .gpx files for some apps. */}
              <input
                hidden
                type="file"
                data-testid="gpx-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void readFile(file);
                }}
              />
            </Button>
            {state.step === 'choose' && state.error && (
              <Alert severity="error" data-testid="gpx-error">
                {state.error}
              </Alert>
            )}
          </Stack>
        )}
        {parsed && state.step === 'preview' && (
          <Stack sx={{ gap: 1.5 }} data-testid="gpx-preview">
            <Alert severity="success">
              Vorschau auf der Karte (gestrichelt). Noch nicht gespeichert.
            </Alert>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              slotProps={{
                htmlInput: { maxLength: 120, style: { fontSize: 16 } },
              }}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
              }}
            >
              <Fact label="Länge (2D)" value={formatMetres(parsed.lengthM)} />
              <Fact label="Abschnitte" value={String(parsed.segments.length)} />
              <Fact
                label="Punkte"
                value={parsed.pointCount.toLocaleString('de-DE')}
              />
              <Fact
                label="Höhenbereich"
                value={
                  parsed.elevation
                    ? `${formatAltitude(parsed.elevation.minM)} – ${formatAltitude(parsed.elevation.maxM)}`
                    : 'nicht in der Datei'
                }
              />
            </Box>
            {parsed.segments.length > 1 && (
              <Typography variant="body2" color="text.secondary">
                Die Abschnitte werden getrennt gespeichert und nicht durch
                Luftlinien verbunden.
              </Typography>
            )}
            {(parsed.skippedPoints > 0 || parsed.skippedSegments > 0) && (
              <Alert severity="warning">
                {parsed.skippedPoints} ungültige Punkte und{' '}
                {parsed.skippedSegments} zu kurze Abschnitte wurden
                übersprungen. Bitte die Vorschau prüfen.
              </Alert>
            )}
            {tour && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={attach}
                    onChange={(event) => setAttach(event.target.checked)}
                  />
                }
                label={`Mit „${tour.label}“ verknüpfen`}
              />
            )}
            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Abbrechen
        </Button>
        {parsed && (
          <>
            <Button
              onClick={() => {
                hideTrack(PREVIEW_ID);
                setState({ step: 'choose' });
              }}
              sx={{ minHeight: 44 }}
            >
              Andere Datei
            </Button>
            <Button variant="contained" onClick={save} sx={{ minHeight: 44 }}>
              Auf diesem Gerät speichern
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

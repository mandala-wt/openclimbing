import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import {
  FAVORITES_ID,
  VISITED_ID,
} from '../../services/my-lists/localFerrataLists';
import {
  applyImportToStore,
  ConflictChoice,
  createExport,
  ImportPlan,
  MAX_IMPORT_BYTES,
  planHasChanges,
  planImport,
  validateImport,
} from '../../services/kletterglueck/personalData';
import { useMyListsContext } from '../utils/MyListsContext';
import { usePersonalData } from '../utils/PersonalDataContext';
import { readFileText, shareOrDownload } from './shareFile';
import { formatDate } from './format';

const Line = ({ count, text }: { count: number; text: string }) =>
  count ? (
    <li>
      <strong>{count}</strong> {text}
    </li>
  ) : null;

const ImportSummary = ({ plan }: { plan: ImportPlan }) => (
  <Box component="ul" sx={{ pl: 2.5, my: 1 }} data-testid="import-summary">
    <Line count={plan.newFavorites.length} text="neue Favoriten" />
    <Line count={plan.newVisited.length} text="neue besuchte Touren" />
    <Line
      count={plan.customLists.reduce((sum, l) => sum + l.newItems.length, 0)}
      text="Einträge in eigenen Listen"
    />
    <Line
      count={plan.customLists.filter((l) => !l.exists).length}
      text="neue eigene Listen"
    />
    <Line count={plan.newEntries.length} text="neue Notizen" />
    <Line count={plan.newTracks.length} text="neue Tracks" />
    <Line
      count={plan.duplicateListItems + plan.sameEntries + plan.duplicateTracks}
      text="Einträge sind schon vorhanden und werden übersprungen"
    />
    <Line count={plan.invalid} text="ungültige Einträge werden ignoriert" />
    <Line
      count={plan.conflicts.length}
      text="Notizen unterscheiden sich von den vorhandenen (siehe unten)"
    />
  </Box>
);

export const PersonalDataTransfer = () => {
  const { lists, addToList, createList } = useMyListsContext();
  const { store, update } = usePersonalData();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [exportedAt, setExportedAt] = useState('');
  const [choice, setChoice] = useState<ConflictChoice>('keep');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    const data = createExport(lists ?? [], store);
    const date = data.exportedAt.slice(0, 10);
    const result = await shareOrDownload(
      JSON.stringify(data, null, 2),
      `kletterglueck-meine-touren-${date}.json`,
      'application/json',
    );
    if (result !== 'cancelled') {
      setMessage({
        ok: true,
        text: 'Export erstellt. Die Datei enthält Favoriten, Besuche, Listen, Notizen und eigene Tracks.',
      });
    }
  };

  const readImport = async (file: File) => {
    setMessage(null);
    try {
      const validated = validateImport(
        await readFileText(file, MAX_IMPORT_BYTES),
      );
      setExportedAt(validated.data.exportedAt);
      setChoice('keep');
      setPlan(planImport(lists ?? [], store, validated));
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : 'Import fehlgeschlagen.',
      });
    }
  };

  const applyImport = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      // Store first: it can fail on a full device, the lists cannot.
      update((current) => applyImportToStore(current, plan, choice));
      for (const item of plan.newFavorites) {
        await addToList(FAVORITES_ID, item);
      }
      for (const item of plan.newVisited) {
        await addToList(VISITED_ID, item);
      }
      for (const { list, newItems, exists } of plan.customLists) {
        const target = exists
          ? (lists ?? []).find(
              (l) =>
                l.name.trim().toLocaleLowerCase('de') ===
                list.name.toLocaleLowerCase('de'),
            )?.id
          : await createList(list.name, list.emoji || '📍', list.color);
        if (target === undefined) continue;
        for (const item of newItems) await addToList(target, item);
      }
      setMessage({ ok: true, text: 'Import übernommen.' });
      setPlan(null);
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : 'Import fehlgeschlagen.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack sx={{ gap: 1 }}>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => void exportData()}
          sx={{ minHeight: 48, textTransform: 'none' }}
        >
          Als JSON exportieren
        </Button>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadIcon />}
          sx={{ minHeight: 48, textTransform: 'none' }}
        >
          JSON importieren …
          <input
            hidden
            type="file"
            data-testid="json-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void readImport(file);
            }}
          />
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        So kommen die Daten auf ein anderes Gerät: hier exportieren, Datei z. B.
        per AirDrop schicken und dort importieren. Vorhandene Einträge bleiben
        erhalten.
      </Typography>
      {message && (
        <Alert
          severity={message.ok ? 'success' : 'error'}
          onClose={() => setMessage(null)}
          data-testid="transfer-message"
        >
          {message.text}
        </Alert>
      )}
      <Dialog
        open={Boolean(plan)}
        onClose={() => setPlan(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Import prüfen</DialogTitle>
        {plan && (
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Export vom {formatDate(exportedAt)}. Noch wurde nichts geändert.
            </Typography>
            {planHasChanges(plan) ? (
              <ImportSummary plan={plan} />
            ) : (
              <Alert severity="info" sx={{ my: 1 }}>
                Alles in dieser Datei ist schon auf diesem Gerät vorhanden.
              </Alert>
            )}
            {plan.conflicts.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  Unterschiedliche Notizen
                </Typography>
                <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                  {plan.conflicts.slice(0, 5).map((conflict) => (
                    <li key={conflict.shortId}>
                      <strong>{conflict.label}</strong>: vorhanden „
                      {conflict.current.note.slice(0, 60) || '–'}“, Datei „
                      {conflict.incoming.note.slice(0, 60) || '–'}“
                    </li>
                  ))}
                  {plan.conflicts.length > 5 && (
                    <li>… und {plan.conflicts.length - 5} weitere</li>
                  )}
                </Box>
                <RadioGroup
                  value={choice}
                  onChange={(event) =>
                    setChoice(event.target.value as ConflictChoice)
                  }
                >
                  <FormControlLabel
                    value="keep"
                    control={<Radio />}
                    label="Vorhandene Notizen behalten (empfohlen)"
                  />
                  <FormControlLabel
                    value="replace"
                    control={<Radio />}
                    label="Notizen aus der Datei übernehmen"
                  />
                </RadioGroup>
              </Box>
            )}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPlan(null)} sx={{ minHeight: 44 }}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            disabled={!plan || !planHasChanges(plan) || busy}
            onClick={() => void applyImport()}
            sx={{ minHeight: 44 }}
          >
            Übernehmen
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useFeatureContext } from '../../utils/FeatureContext';
import { estimateTourSize, saveTour, getUsedSpace } from '../../../services/offline/tourStorage';
import { QuickActionButton } from './QuickActionButton';
import { readNorissteigTrack } from './norissteigTrack';

export const OfflineSaveAction = () => {
  const { feature } = useFeatureContext();
  const [open, setOpen] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleOpen = async () => {
    const size = await estimateTourSize(feature);
    setEstimate(size);
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For Norissteig the track is handled separately; general tours store available tags/description
      await saveTour(feature);
      const space = await getUsedSpace();
      setUsed(space);
      setOpen(false);
      // TODO: toast success with used space
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const formatBytes = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

  return (
    <>
      <QuickActionButton
        icon={<DownloadIcon />}
        label="Für unterwegs speichern"
        onClick={handleOpen}
      />
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Tour für unterwegs speichern</DialogTitle>
        <DialogContent>
          <Typography>
            Ungefährer Speicherbedarf: {estimate != null ? formatBytes(estimate) : '…'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Gespeichert werden Name, Lage, Schwierigkeit und vorhandene Beschreibung aus OpenStreetMap.
            Kartenkacheln werden aus Lizenzgründen (MapTiler / OpenStreetMap) nicht heruntergeladen.
            Offline ist die Karte daher nicht verfügbar; Track und Standort funktionieren, wenn gespeichert.
          </Typography>
          {used != null && (
            <Typography sx={{ mt: 1 }}>Belegter Platz nach dem Speichern: {formatBytes(used)}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Speichere…' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

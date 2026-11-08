import { useEffect, useState } from 'react';
import { Box, Button, Typography, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { getAllTours, deleteTour, SavedTour, getUsedSpace } from '../../src/services/offline/tourStorage';
import { useOnlineStatus } from '../../src/services/offline/useOnlineStatus';
import Head from 'next/head';

export default function UnterwegsPage() {
  const [tours, setTours] = useState<SavedTour[]>([]);
  const [used, setUsed] = useState(0);
  const online = useOnlineStatus();

  const load = async () => {
    const all = await getAllTours();
    setTours(all);
    setUsed(await getUsedSpace());
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteTour(id);
    load();
  };

  const formatBytes = (b: number) =>
    b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;

  return (
    <>
      <Head>
        <title>Für unterwegs – Kletterglück</title>
      </Head>
      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" gutterBottom>
          Gespeicherte Touren für unterwegs
        </Typography>
        <Typography color={online ? 'success.main' : 'warning.main'} gutterBottom>
          {online ? 'Netz vorhanden' : 'Kein Netz – nur gespeicherte Touren verfügbar'}
        </Typography>
        <Typography variant="body2" gutterBottom>
          Belegter Speicher: {formatBytes(used)}
        </Typography>
        {!online && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Kartenkacheln sind offline nicht verfügbar (Lizenz der Kartenanbieter).
            Track und Standort funktionieren für gespeicherte Touren.
          </Typography>
        )}
        <List>
          {tours.map((tour) => (
            <ListItem
              key={tour.shortId}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleDelete(tour.shortId)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={tour.name}
                secondary={`Gespeichert am ${new Date(tour.savedAt).toLocaleString('de-DE')} · ${formatBytes(tour.sizeBytes)}`}
              />
              <Button
                size="small"
                href={`/unterwegs/${tour.shortId}`}
                sx={{ ml: 1 }}
              >
                Öffnen
              </Button>
            </ListItem>
          ))}
          {tours.length === 0 && (
            <Typography>Noch keine Touren gespeichert.</Typography>
          )}
        </List>
        <Button href="/notfall" variant="outlined" sx={{ mt: 2 }} fullWidth>
          Notfall / Position teilen
        </Button>
      </Box>
    </>
  );
}

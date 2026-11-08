import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Typography, Button } from '@mui/material';
import { getTour, SavedTour } from '../../../src/services/offline/tourStorage';
import { useOnlineStatus } from '../../../src/services/offline/useOnlineStatus';
import Head from 'next/head';

export default function TourDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [tour, setTour] = useState<SavedTour | null>(null);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    if (typeof id === 'string') {
      getTour(id).then(setTour);
    }
  }, [id]);

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((s) => { sentinel = s; }).catch(() => {});
    }
    return () => { sentinel?.release(); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      setPos,
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  if (!tour) return <Typography sx={{ p: 2 }}>Lade Tour… oder nicht gefunden.</Typography>;

  return (
    <>
      <Head>
        <title>{tour.name} – Unterwegs</title>
      </Head>
      <Box sx={{ p: 2 }}>
        <Typography variant="h5">{tour.name}</Typography>
        <Typography>
          Gespeichert: {new Date(tour.savedAt).toLocaleString('de-DE')}
        </Typography>
        <Typography color={online ? 'success.main' : 'warning.main'}>
          {online ? 'Online' : 'Offline'}
        </Typography>
        {pos && (
          <Box sx={{ mt: 2, fontSize: '1.2rem' }}>
            <Typography>Position: {pos.coords.latitude.toFixed(5)}, {pos.coords.longitude.toFixed(5)}</Typography>
            <Typography>Genauigkeit: ±{Math.round(pos.coords.accuracy)} m</Typography>
            <Typography>Zeit: {new Date(pos.timestamp).toLocaleTimeString('de-DE')}</Typography>
          </Box>
        )}
        {!pos && <Typography>Standort wird ermittelt… (Freigabe erforderlich)</Typography>}
        {tour.track && (
          <Typography sx={{ mt: 2 }}>
            Track vorhanden ({tour.track.features?.[0]?.geometry?.coordinates?.length || 0} Punkte)
          </Typography>
        )}
        {!tour.track && <Typography>Kein Track gespeichert.</Typography>}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Volle Karte offline nicht verfügbar. Nur gespeicherte Daten und Standort.
        </Typography>
        <Button href="/unterwegs" sx={{ mt: 2 }}>
          Zurück zur Liste
        </Button>
      </Box>
    </>
  );
}

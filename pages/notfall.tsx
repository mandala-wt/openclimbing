import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import Head from 'next/head';

function toDMS(deg: number, isLat: boolean) {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(1);
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  return `${d}° ${m}' ${s}" ${dir}`;
}

export default function NotfallPage() {
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Standort nicht verfügbar');
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setPos(p);
        setError(null);
      },
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const share = async () => {
    if (!pos) return;
    const text = `Meine Position: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy)} m)`;
    if (navigator.share) {
      try {
        await navigator.share({ text, title: 'Notfall-Position' });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      alert('In Zwischenablage kopiert');
    }
  };

  return (
    <>
      <Head>
        <title>Notfall – Position</title>
      </Head>
      <Box sx={{ p: 2, fontSize: '1.1rem' }}>
        <Typography variant="h4" gutterBottom>
          Notfall
        </Typography>
        <Typography color="error" gutterBottom>
          Europäische Notrufnummer: 112
        </Typography>
        <Typography gutterBottom>
          Bergrettung: Je nach Region (z. B. Bergwacht in Deutschland). Keine Garantie auf Erreichbarkeit oder Hilfe.
        </Typography>
        {error && <Typography color="warning.main">{error}</Typography>}
        {pos ? (
          <>
            <Typography>Dezimal: {pos.coords.latitude.toFixed(6)}, {pos.coords.longitude.toFixed(6)}</Typography>
            <Typography>DMS: {toDMS(pos.coords.latitude, true)} {toDMS(pos.coords.longitude, false)}</Typography>
            <Typography>Genauigkeit: ±{Math.round(pos.coords.accuracy)} m</Typography>
            <Typography>Letzte Ortung: {new Date(pos.timestamp).toLocaleString('de-DE')}</Typography>
            {pos.coords.altitude != null && (
              <Typography>Höhe: {Math.round(pos.coords.altitude)} m (falls vom Gerät geliefert)</Typography>
            )}
            <Button onClick={share} variant="contained" sx={{ mt: 2, fontSize: '1.2rem', py: 1.5 }} fullWidth>
              Position teilen
            </Button>
          </>
        ) : (
          <Typography>Standort wird ermittelt… Bitte Standortfreigabe erteilen.</Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Diese Ansicht zeigt nur die vom Gerät gelieferte Position. Keine Aussagen zu Wetter, Sperrungen oder Begehbarkeit. Keine Sicherheitsgarantie.
        </Typography>
      </Box>
    </>
  );
}

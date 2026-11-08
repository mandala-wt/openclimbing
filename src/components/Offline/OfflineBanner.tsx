import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

const readOnline = () =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

export const OfflineBanner = () => {
  const [online, setOnline] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setOnline(readOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/kletterglueck-sw.js').catch(() => {
        setFailed(true);
      });
    }
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const text = failed
    ? 'Offline-Start konnte nicht eingerichtet werden.'
    : 'Kein Netz. Suche, frische Daten, Fotos und der Kartenhintergrund fehlen. Gespeicherte Touren bleiben nutzbar.';

  if (online && !failed) return null;

  return (
    <Box
      role="status"
      sx={{
        position: 'absolute',
        zIndex: 1250,
        top: 0,
        left: 0,
        right: 0,
        px: 1,
        pt: 'calc(env(safe-area-inset-top) + 4px)',
        pb: 0.5,
        fontWeight: 700,
        fontSize: 14,
        color: '#fffdf8',
        backgroundColor: '#7f1d1d',
        pointerEvents: 'none',
      }}
    >
      {text}
    </Box>
  );
};

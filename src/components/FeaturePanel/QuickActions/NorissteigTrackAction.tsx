import AltRouteIcon from '@mui/icons-material/AltRoute';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { LngLatBounds } from 'maplibre-gl';
import { mapCreatedPromise } from '../../../services/mapStorage';
import {
  NORISSTEIG_ENTRY,
  NORISSTEIG_START,
  readNorissteigTrack,
} from './norissteigTrack';
import {
  forgetSessionTrack,
  rememberSessionTrack,
} from '../../../services/offline/sessionTracks';
import { QuickActionButton } from './QuickActionButton';

const SOURCE_ID = 'norissteig-pilot-track';
const LINE_ID = `${SOURCE_ID}-line`;
const POINTS_ID = `${SOURCE_ID}-points`;

type Track = ReturnType<typeof readNorissteigTrack>;

const useTrackOverlay = (track: Track | null) => {
  useEffect(() => {
    if (!track) return undefined;

    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void mapCreatedPromise.then((map) => {
      if (cancelled) return;

      const addOverlay = () => {
        if (map.getSource(SOURCE_ID)) return;
        map.addSource(SOURCE_ID, { type: 'geojson', data: track });
        map.addLayer({
          id: LINE_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#1759c7', 'line-width': 5 },
        });
        map.addLayer({
          id: POINTS_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-color': [
              'match',
              ['get', 'label'],
              'Start',
              '#167345',
              '#ad481d',
            ],
            'circle-radius': 6,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });
      };

      map.on('style.load', addOverlay);
      if (map.isStyleLoaded()) addOverlay();

      const bounds = new LngLatBounds();
      for (const { geometry } of track.features) {
        const points =
          geometry.type === 'Point'
            ? [geometry.coordinates]
            : geometry.coordinates;
        for (const [lon, lat] of points) bounds.extend([lon, lat]);
      }
      map.fitBounds(bounds, { padding: 44, maxZoom: 16, duration: 0 });

      cleanup = () => {
        map.off('style.load', addOverlay);
        for (const id of [POINTS_ID, LINE_ID]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [track]);
};

const TOUR_ID = 'way/1156787758';

const rememberPilot = (track: Track) => {
  const line = track.features.find(
    (feature) => feature.geometry.type === 'LineString',
  );
  if (!line || line.geometry.type !== 'LineString') return;
  rememberSessionTrack(TOUR_ID, {
    id: 'norissteig-pilot',
    label: 'Norissteig-Pilottrack',
    source:
      'GPX-Datei, in diesem Tab gelesen. Nicht mit der OpenStreetMap-Linie vermischt.',
    readAt: new Date().toISOString(),
    points: line.geometry.coordinates
      .filter(
        (pair): pair is [number, number] =>
          pair.length >= 2 &&
          Number.isFinite(pair[0]) &&
          Number.isFinite(pair[1]),
      )
      .map(([lon, lat]) => ({ lon, lat })),
  });
};

export const NorissteigTrackAction = () => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [track, setTrack] = useState<Track | null>(null);
  useTrackOverlay(track);

  const loadTrack = async (file: File) => {
    try {
      if (file.size > 250_000) throw new Error('GPX ist zu groß.');
      const next = readNorissteigTrack(await file.text());
      setTrack(next);
      rememberPilot(next);
      setError(false);
      setOpen(false);
    } catch {
      setError(true);
    }
  };

  return (
    <>
      <QuickActionButton
        icon={AltRouteIcon}
        label="Norissteig-Tour"
        pressed={Boolean(track)}
        onClick={() => {
          setError(false);
          setOpen(true);
        }}
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Norissteig · Testtour</DialogTitle>
        <DialogContent>
          <Typography>B/C · ca. 3 Stunden · ca. 3,52 km</Typography>
          <Typography>
            Start (grün): {NORISSTEIG_START[1]}, {NORISSTEIG_START[0]}
          </Typography>
          <Typography>
            Einstieg (orange): {NORISSTEIG_ENTRY[1]}, {NORISSTEIG_ENTRY[0]}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Lade die Norissteig-GPX-Datei mit 291 Punkten von deinem Gerät. Die
            Datei bleibt in diesem Browser-Tab. Der Track ist eine durchgehende
            Linie ohne verifizierte Einteilung in Zustieg, Steig und Abstieg.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Die Datei ließ sich nicht als Norissteig-Pilottrack lesen.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Schließen</Button>
          {track && (
            <Button
              onClick={() => {
                setTrack(null);
                forgetSessionTrack(TOUR_ID);
                setOpen(false);
              }}
            >
              Ausblenden
            </Button>
          )}
          <Button component="label" variant="contained">
            GPX auswählen
            <input
              hidden
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void loadTrack(file);
              }}
            />
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

import DownloadIcon from '@mui/icons-material/Download';
import MapIcon from '@mui/icons-material/Map';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material';
import React, { useState } from 'react';
import { getShortId } from '../../services/helpers';
import {
  BundledTrack,
  bundledTracksFor,
} from '../../services/kletterglueck/bundledTracks';
import {
  parseGpx,
  safeFileName,
  serializeGpx,
  TrackSegment,
  trackLengthM,
} from '../../services/kletterglueck/gpx';
import { removeTrack } from '../../services/kletterglueck/personalData';
import type { Feature } from '../../services/types';
import { getLabel } from '../../helpers/featureLabel';
import { linesFromGeometry } from '../FeaturePanel/QuickActions/komootGpx';
import { usePersonalData } from '../utils/PersonalDataContext';
import { formatMetres } from './format';
import { GpxImportDialog } from './GpxImportDialog';
import { fitBoundsOnMap } from './openTourOnMap';
import { shareOrDownload } from './shareFile';
import { hideTrack, showTrack, useShownTracks } from './trackOverlay';

const boundsOf = (segments: TrackSegment[]) => {
  const points = segments.flat();
  return [
    Math.min(...points.map(([lon]) => lon)),
    Math.min(...points.map(([, lat]) => lat)),
    Math.max(...points.map(([lon]) => lon)),
    Math.max(...points.map(([, lat]) => lat)),
  ] as [number, number, number, number];
};

const TrackCard = ({
  title,
  details,
  children,
}: {
  title: string;
  details: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
    <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" component="div">
      {details}
    </Typography>
    <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: 'wrap' }}>
      {children}
    </Stack>
  </Box>
);

const buttonSx = { minHeight: 44, textTransform: 'none' } as const;

const BundledTrackCard = ({ track }: { track: BundledTrack }) => {
  const shown = useShownTracks().some(({ id }) => id === track.id);
  const [error, setError] = useState('');
  const toggle = async () => {
    if (shown) {
      hideTrack(track.id);
      return;
    }
    try {
      const response = await fetch(track.url);
      if (!response.ok) throw new Error('Track nicht erreichbar.');
      const parsed = parseGpx(await response.text());
      showTrack({ id: track.id, kind: 'reference', segments: parsed.segments });
      fitBoundsOnMap(parsed.bounds);
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Track nicht erreichbar.',
      );
    }
  };
  return (
    <TrackCard
      title={track.title}
      details={
        <>
          {track.description}{' '}
          <Link href={track.sourceUrl} target="_blank" rel="noopener">
            {track.license}
          </Link>
        </>
      }
    >
      <Button
        variant={shown ? 'contained' : 'outlined'}
        startIcon={<MapIcon />}
        onClick={() => void toggle()}
        sx={buttonSx}
      >
        {shown ? 'Auf der Karte ausblenden' : 'Auf der Karte zeigen'}
      </Button>
      <Button
        component="a"
        href={track.url}
        download={track.fileName}
        startIcon={<DownloadIcon />}
        sx={buttonSx}
      >
        GPX herunterladen
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </TrackCard>
  );
};

export const TourTracks = ({ feature }: { feature: Feature }) => {
  const shortId = getShortId(feature.osmMeta);
  const label = getLabel(feature);
  const { store, update } = usePersonalData();
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState('');
  const bundled = bundledTracksFor(shortId);
  const personal = store.tracks.filter((track) => track.shortId === shortId);
  const osmLines = linesFromGeometry(feature.geometry).filter(
    (line) => line.length >= 2,
  );
  const shownIds = useShownTracks().map(({ id }) => id);

  const download = async (
    name: string,
    segments: TrackSegment[],
    desc: string,
  ) => {
    const result = await shareOrDownload(
      serializeGpx({ name, segments, description: desc }),
      `${safeFileName(name)}.gpx`,
      'application/gpx+xml',
    );
    setMessage(
      result === 'downloaded'
        ? 'GPX-Datei geladen. In Komoot: „Importieren“ und diese Datei wählen.'
        : result === 'shared'
          ? 'GPX-Datei geteilt.'
          : '',
    );
  };

  return (
    <Stack sx={{ gap: 1.25 }} data-testid="tour-tracks">
      {bundled.map((track) => (
        <BundledTrackCard key={track.id} track={track} />
      ))}
      {osmLines.length > 0 && (
        <TrackCard
          title="Linie des Klettersteigs (OpenStreetMap)"
          details={`${formatMetres(
            trackLengthM(osmLines as TrackSegment[]),
          )} · nur die eingezeichnete Steiglinie, ohne Zu- und Abstieg.`}
        >
          <Button
            startIcon={<DownloadIcon />}
            onClick={() =>
              void download(
                label,
                osmLines as TrackSegment[],
                '© OpenStreetMap-Mitwirkende, ODbL 1.0. Nur die Steiglinie.',
              )
            }
            sx={buttonSx}
          >
            GPX der Linie
          </Button>
        </TrackCard>
      )}
      {personal.map((track) => {
        const shown = shownIds.includes(track.id);
        return (
          <TrackCard
            key={track.id}
            title={`Eigener Track: ${track.name}`}
            details={`${formatMetres(track.lengthM)} · ${
              track.segments.length
            } ${track.segments.length === 1 ? 'Abschnitt' : 'Abschnitte'} · auf diesem Gerät`}
          >
            <Button
              startIcon={<MapIcon />}
              onClick={() => fitBoundsOnMap(boundsOf(track.segments))}
              sx={buttonSx}
              aria-pressed={shown}
            >
              Auf der Karte zeigen
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                void download(track.name, track.segments, 'Eigener Track')
              }
              sx={buttonSx}
            >
              GPX
            </Button>
            <Button
              color="error"
              onClick={() => {
                if (
                  window.confirm(
                    `Track „${track.name}“ von diesem Gerät löschen?`,
                  )
                ) {
                  update((current) => removeTrack(current, track.id));
                }
              }}
              sx={buttonSx}
            >
              Löschen
            </Button>
          </TrackCard>
        );
      })}
      {!bundled.length && !osmLines.length && !personal.length && (
        <Typography variant="body2" color="text.secondary">
          Für diese Tour liegt kein verwendbarer Track vor.
        </Typography>
      )}
      <Box>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={() => setImportOpen(true)}
          sx={buttonSx}
        >
          Eigene GPX-Datei importieren
        </Button>
      </Box>
      {message && (
        <Alert severity="info" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      <GpxImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        tour={{ shortId, label }}
        onSaved={setMessage}
      />
    </Stack>
  );
};

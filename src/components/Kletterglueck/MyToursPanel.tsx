import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import MapIcon from '@mui/icons-material/Map';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  MenuItem,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Router from 'next/router';
import React, { useMemo, useState } from 'react';
import { getApiId } from '../../services/helpers';
import {
  buildCollection,
  CollectionFilter,
  CollectionRow,
  CollectionSort,
  filterCollection,
} from '../../services/kletterglueck/collection';
import { safeFileName, serializeGpx } from '../../services/kletterglueck/gpx';
import { removeTrack } from '../../services/kletterglueck/personalData';
import { useMobileMode } from '../helpers';
import { ClosePanelButton } from '../utils/ClosePanelButton';
import { MobilePageDrawer } from '../utils/MobilePageDrawer';
import { useMyListsContext } from '../utils/MyListsContext';
import {
  PanelContent,
  PanelScrollbars,
  PanelSidePadding,
} from '../utils/PanelHelpers';
import { usePersonalData } from '../utils/PersonalDataContext';
import { formatDate, formatMetres } from './format';
import { GpxImportDialog } from './GpxImportDialog';
import { useFerrataCatalog } from './hooks';
import { fitBoundsOnMap, openTourOnMap } from './openTourOnMap';
import { PersonalDataTransfer } from './PersonalDataTransfer';
import { shareOrDownload } from './shareFile';

const FILTERS: { value: CollectionFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'favorites', label: '⭐ Favoriten' },
  { value: 'visited', label: '😊 Besucht' },
  { value: 'notes', label: '📝 Mit Notiz' },
];

const Heading = ({ children }: { children: React.ReactNode }) => (
  <Typography
    component="h2"
    sx={{ fontSize: 18, fontWeight: 800, mt: 3, mb: 1 }}
  >
    {children}
  </Typography>
);

const RowItem = ({
  row,
  onOpen,
}: {
  row: CollectionRow;
  onOpen: () => void;
}) => (
  <ListItemButton
    onClick={onOpen}
    sx={{
      minHeight: 60,
      px: 2,
      alignItems: 'flex-start',
      flexDirection: 'column',
    }}
    data-testid="collection-row"
  >
    <Typography sx={{ fontWeight: 700 }}>
      {row.label}
      {row.favorite && ' ⭐'}
      {row.visited && ' 😊'}
    </Typography>
    <Stack
      direction="row"
      sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
    >
      {row.visitedOn && (
        <Typography variant="body2" color="text.secondary">
          Besucht am {formatDate(row.visitedOn)}
        </Typography>
      )}
      {row.stars && <Rating value={row.stars} readOnly size="small" />}
      {row.trackCount > 0 && (
        <Typography variant="body2" color="text.secondary">
          {row.trackCount} {row.trackCount === 1 ? 'Track' : 'Tracks'}
        </Typography>
      )}
    </Stack>
    {row.note && (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {row.note}
      </Typography>
    )}
  </ListItemButton>
);

const TrackList = () => {
  const { store, update } = usePersonalData();
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <>
      {store.tracks.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Noch keine eigenen Tracks gespeichert.
        </Typography>
      )}
      <Stack sx={{ gap: 1 }}>
        {store.tracks.map((track) => {
          const points = track.segments.flat();
          const bounds: [number, number, number, number] = [
            Math.min(...points.map(([lon]) => lon)),
            Math.min(...points.map(([, lat]) => lat)),
            Math.max(...points.map(([lon]) => lon)),
            Math.max(...points.map(([, lat]) => lat)),
          ];
          return (
            <Stack
              key={track.id}
              direction="row"
              sx={{
                alignItems: 'center',
                gap: 0.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                pl: 1.5,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, py: 1 }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {track.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatMetres(track.lengthM)} · importiert am{' '}
                  {formatDate(track.importedAt)}
                </Typography>
              </Box>
              <IconButton
                aria-label={`${track.name} auf der Karte zeigen`}
                onClick={() => fitBoundsOnMap(bounds)}
                sx={{ width: 48, height: 48 }}
              >
                <MapIcon />
              </IconButton>
              <IconButton
                aria-label={`${track.name} als GPX speichern`}
                onClick={() =>
                  void shareOrDownload(
                    serializeGpx({
                      name: track.name,
                      segments: track.segments,
                    }),
                    `${safeFileName(track.name)}.gpx`,
                    'application/gpx+xml',
                  )
                }
                sx={{ width: 48, height: 48 }}
              >
                <DownloadIcon />
              </IconButton>
              <IconButton
                aria-label={`${track.name} löschen`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Track „${track.name}“ von diesem Gerät löschen?`,
                    )
                  ) {
                    update((current) => removeTrack(current, track.id));
                  }
                }}
                sx={{ width: 48, height: 48 }}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          );
        })}
      </Stack>
      <Button
        variant="outlined"
        startIcon={<UploadFileIcon />}
        onClick={() => setImportOpen(true)}
        sx={{ mt: 1, minHeight: 48, textTransform: 'none' }}
      >
        GPX-Datei importieren
      </Button>
      {message && (
        <Alert severity="success" onClose={() => setMessage('')} sx={{ mt: 1 }}>
          {message}
        </Alert>
      )}
      <GpxImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={setMessage}
      />
    </>
  );
};

const Body = () => {
  const { lists } = useMyListsContext();
  const { store, ready } = usePersonalData();
  const { data } = useFerrataCatalog();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [sort, setSort] = useState<CollectionSort>('changed');

  const all = useMemo(() => buildCollection(lists, store), [lists, store]);
  const rows = useMemo(
    () => filterCollection(all, { query, filter, sort }),
    [all, query, filter, sort],
  );

  const open = (row: CollectionRow) => {
    const area = data?.index.byShortId.get(row.shortId);
    const { type, id } = getApiId(row.shortId);
    const center = row.center ?? (area ? [area.lon, area.lat] : null);
    if (center) {
      void openTourOnMap(
        { osmType: type, osmId: id, lon: center[0], lat: center[1] },
        '/meine-touren',
      );
    } else {
      void Router.push(`/${type}/${id}?back=/meine-touren`);
    }
  };

  return (
    <PanelSidePadding>
      <ClosePanelButton right onClick={() => Router.push('/')} />
      <h1>Meine Touren</h1>
      <Alert severity="info" icon={false} sx={{ mb: 2 }}>
        Favoriten, Besuche, Notizen und eigene Tracks sind nur in diesem Browser
        auf diesem Gerät gespeichert. Es gibt keine automatische
        Synchronisierung zwischen iPhone und iPad. Zum Übertragen unten
        exportieren und auf dem anderen Gerät importieren.
      </Alert>
      <TextField
        fullWidth
        type="search"
        label="In meinen Touren suchen"
        value={query}
        onChange={(event) => setQuery(event.target.value.slice(0, 80))}
        slotProps={{
          htmlInput: { enterKeyHint: 'search', style: { fontSize: 16 } },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', my: 1.5 }}>
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            aria-pressed={filter === value}
            variant={filter === value ? 'contained' : 'outlined'}
            onClick={() => setFilter(value)}
            sx={{ minHeight: 44, textTransform: 'none' }}
          >
            {label}
          </Button>
        ))}
      </Stack>
      <TextField
        select
        size="small"
        label="Sortierung"
        value={sort}
        onChange={(event) => setSort(event.target.value as CollectionSort)}
        sx={{ minWidth: 220 }}
      >
        <MenuItem value="changed">Zuletzt geändert</MenuItem>
        <MenuItem value="visitedOn">Besuchsdatum (neueste zuerst)</MenuItem>
        <MenuItem value="name">Name (A–Z)</MenuItem>
      </TextField>
      <Typography
        role="status"
        variant="body2"
        color="text.secondary"
        sx={{ mt: 1.5 }}
      >
        {ready
          ? `${rows.length} von ${all.length} ${all.length === 1 ? 'Tour' : 'Touren'}`
          : 'Wird geladen …'}
      </Typography>
      {ready && all.length === 0 && (
        <Typography sx={{ mt: 1 }}>
          Noch nichts gesammelt. In einer Tour „Als Favorit merken“ oder „Als
          besucht markieren“ antippen.
        </Typography>
      )}
      {ready && all.length > 0 && rows.length === 0 && (
        <Typography sx={{ mt: 1 }}>
          Keine Tour passt zu Suche und Auswahl.
        </Typography>
      )}
      <List sx={{ mx: -2 }} aria-label="Meine Touren">
        {rows.map((row) => (
          <RowItem key={row.shortId} row={row} onOpen={() => open(row)} />
        ))}
      </List>
      <Heading>Eigene Tracks</Heading>
      <TrackList />
      <Heading>Daten sichern und übertragen</Heading>
      <PersonalDataTransfer />
      <Box sx={{ height: 'calc(32px + env(safe-area-inset-bottom))' }} />
    </PanelSidePadding>
  );
};

export const MyToursPanel = () => {
  const mobile = useMobileMode();
  return (
    <MobilePageDrawer className="my-tours-drawer">
      <PanelContent $grow={mobile}>
        {mobile ? (
          <Body />
        ) : (
          <PanelScrollbars>
            <Body />
          </PanelScrollbars>
        )}
      </PanelContent>
    </MobilePageDrawer>
  );
};

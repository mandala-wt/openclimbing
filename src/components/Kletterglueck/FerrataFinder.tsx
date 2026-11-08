import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { ClimbingArea } from '../../services/climbing-areas/getClimbingAreas';
import { getCountryFlag, getCountryName } from '../../services/getCountryFlag';
import {
  boundsOfAreas,
  LonLatBounds,
  MAX_QUERY_LENGTH,
  searchTours,
  shortIdOfArea,
} from '../../services/kletterglueck/tourSearch';
import { getFerrataMeasure } from '../../services/tagging/ferrataMeasures';
import { describeViaFerrataScale } from '../../services/tagging/viaFerrataScale';
import { useMobileMode } from '../helpers';
import { useFeatureContext } from '../utils/FeatureContext';
import { useMapStateContext } from '../utils/MapStateContext';
import { useUserSettingsContext } from '../utils/userSettings/UserSettingsContext';
import { ViaFerrataScaleChip } from '../utils/ViaFerrataScaleChip';
import type { Feature } from '../../services/types';
import { ActiveFilterChips } from './ActiveFilterChips';
import { FilterSheet } from './FilterSheet';
import { useFerrataCatalog, usePersonalSets, useTourFilter } from './hooks';
import { fitBoundsOnMap, openTourOnMap } from './openTourOnMap';
import { formatMetres } from './format';

const PAGE = 40;
type SortBy = 'relevance' | 'name' | 'distance';

// Survive switching between list and details within the session.
const session = {
  get: (key: string) => {
    try {
      return window.sessionStorage.getItem(`kletterglueck.finder.${key}`);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      window.sessionStorage.setItem(`kletterglueck.finder.${key}`, value);
    } catch {
      // private mode – the value just isn't remembered
    }
  },
};

const useSessionState = <T extends string>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const stored = session.get(key);
    if (stored !== null) setValue(stored as T);
  }, [key]);
  const set = (next: T) => {
    setValue(next);
    session.set(key, next);
  };
  return [value, set] as const;
};

const useDebounced = <T,>(value: T, ms: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

const distanceKm = (a: [number, number], b: ClimbingArea) => {
  const rad = Math.PI / 180;
  const x = (b.lon - a[0]) * rad * Math.cos(((a[1] + b.lat) / 2) * rad);
  const y = (b.lat - a[1]) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
};

const ResultRow = ({
  area,
  favorite,
  visited,
  onOpen,
  onHover,
}: {
  area: ClimbingArea;
  favorite: boolean;
  visited: boolean;
  onOpen: () => void;
  onHover?: (on: boolean) => void;
}) => {
  const measure = getFerrataMeasure(area.osmId);
  const place = [area.city, getCountryName(area.countryCode, 'de')]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListItemButton
      onClick={onOpen}
      onMouseEnter={onHover && (() => onHover(true))}
      onMouseLeave={onHover && (() => onHover(false))}
      sx={{ minHeight: 60, gap: 1.25, alignItems: 'center', px: 2 }}
      data-testid="tour-result"
    >
      <Box sx={{ fontSize: 22, width: 28, textAlign: 'center' }} aria-hidden>
        {getCountryFlag(area.countryCode) || '🧗'}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}
        >
          {area.name || 'Ohne Namen'}
          {favorite && (
            <span role="img" aria-label="Favorit">
              {' '}
              ⭐
            </span>
          )}
          {visited && (
            <span role="img" aria-label="Besucht">
              {' '}
              😊
            </span>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {place || 'Ort unbekannt'}
          {measure ? ` · ${formatMetres(measure.lengthM)} Linie` : ''}
        </Typography>
      </Box>
      {area.viaFerrataScale ? (
        <ViaFerrataScaleChip
          scale={area.viaFerrataScale}
          label={
            describeViaFerrataScale(area.viaFerrataScale)?.letter ??
            area.viaFerrataScale
          }
        />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Grad ?
        </Typography>
      )}
    </ListItemButton>
  );
};

export const FerrataFinder = () => {
  const router = useRouter();
  const mobile = useMobileMode();
  const { bbox } = useMapStateContext();
  const { setPreview } = useFeatureContext();
  const filter = useTourFilter();
  const sets = usePersonalSets();
  const { numberOfActiveFilters } = useUserSettingsContext().climbingFilter;
  const { data, isLoading, isError, error, refetch, isFetching } =
    useFerrataCatalog();

  const [query, setQuery] = useSessionState<string>('query', '');
  const [inView, setInView] = useSessionState<'0' | '1'>('inView', '0');
  const [sortBy, setSortBy] = useSessionState<SortBy>('sort', 'relevance');
  const [filterOpen, setFilterOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const debouncedQuery = useDebounced(query, 150);

  // [west, north, east, south] → [west, south, east, north]
  const bounds: LonLatBounds | null =
    inView === '1' && bbox ? [bbox[0], bbox[3], bbox[2], bbox[1]] : null;

  const search = useMemo(() => {
    if (!data) return null;
    const result = searchTours(data.catalog, {
      query: debouncedQuery,
      filter,
      sets,
      bounds,
    });
    if (sortBy === 'name' || (sortBy === 'relevance' && !debouncedQuery)) {
      result.results.sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', 'de'),
      );
    } else if (sortBy === 'distance' && bbox) {
      const center: [number, number] = [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2,
      ];
      result.results.sort(
        (a, b) => distanceKm(center, a) - distanceKm(center, b),
      );
    }
    return result;
    // bounds is derived from bbox and inView
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, debouncedQuery, filter, sets, inView, bbox, sortBy]);

  useEffect(() => setLimit(PAGE), [debouncedQuery, filter, inView, sortBy]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const results = search?.results ?? [];
  const hiddenByFilters = search ? search.beforeFilters - results.length : 0;
  const back = router.asPath;

  const showAllOnMap = () => {
    const box = boundsOfAreas(results.slice(0, 200));
    if (box) fitBoundsOnMap(box);
  };

  return (
    <Box sx={{ pb: 'env(safe-area-inset-bottom)' }}>
      <Box sx={{ px: 2 }}>
        <Box
          component="form"
          role="search"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        >
          <TextField
            fullWidth
            value={query}
            onChange={(event) =>
              setQuery(event.target.value.slice(0, MAX_QUERY_LENGTH))
            }
            label="Tourname oder Ort"
            placeholder="z. B. Norissteig, Hirschbach, Österreich"
            type="search"
            autoComplete="off"
            slotProps={{
              htmlInput: {
                enterKeyHint: 'search',
                'aria-describedby': 'finder-status',
                // 16px avoids the automatic zoom of iOS Safari
                style: { fontSize: 16 },
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Suche leeren"
                      onClick={() => setQuery('')}
                      edge="end"
                      sx={{ width: 44, height: 44 }}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        </Box>
        <Stack
          direction="row"
          sx={{
            mt: 1,
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <FormControlLabel
            sx={{ mr: 0, minHeight: 44 }}
            control={
              <Switch
                checked={inView === '1'}
                onChange={(event) =>
                  setInView(event.target.checked ? '1' : '0')
                }
              />
            }
            label="Nur im Kartenausschnitt"
          />
          <Badge
            color="error"
            badgeContent={numberOfActiveFilters}
            invisible={!numberOfActiveFilters}
          >
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setFilterOpen(true)}
              sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
            >
              Filter
            </Button>
          </Badge>
        </Stack>
        <ActiveFilterChips />
      </Box>

      <Box sx={{ px: 2, mt: 1 }}>
        <Typography
          id="finder-status"
          role="status"
          aria-live="polite"
          variant="body2"
          color="text.secondary"
        >
          {isLoading
            ? 'Klettersteige werden geladen …'
            : search
              ? `${results.length.toLocaleString('de-DE')} ${
                  results.length === 1 ? 'Tour' : 'Touren'
                }${bounds ? ' im Kartenausschnitt' : ''}${
                  hiddenByFilters > 0
                    ? ` · ${hiddenByFilters.toLocaleString('de-DE')} durch Filter ausgeblendet`
                    : ''
                }`
              : ''}
        </Typography>
        {search && results.length > 1 && (
          <Stack
            direction="row"
            sx={{ gap: 1, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}
          >
            <TextField
              select
              size="small"
              label="Sortierung"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
              sx={{ minWidth: 190 }}
            >
              <MenuItem value="relevance">Beste Treffer</MenuItem>
              <MenuItem value="name">Name (A–Z)</MenuItem>
              <MenuItem value="distance">Nähe zur Kartenmitte</MenuItem>
            </TextField>
            <Button
              onClick={showAllOnMap}
              sx={{ minHeight: 44, textTransform: 'none' }}
            >
              Treffer auf der Karte zeigen
            </Button>
          </Stack>
        )}
      </Box>

      {isLoading && (
        <Stack sx={{ alignItems: 'center', py: 4 }}>
          <CircularProgress aria-label="Lädt" />
        </Stack>
      )}

      {isError && (
        <Box sx={{ px: 2, py: 1 }}>
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                onClick={() => void refetch()}
                disabled={isFetching}
                sx={{ minHeight: 44 }}
              >
                Erneut versuchen
              </Button>
            }
          >
            Die Klettersteige konnten nicht geladen werden. Bitte
            Internetverbindung prüfen.
            {error instanceof Error && error.message.includes('Format')
              ? ` (${error.message})`
              : ''}
          </Alert>
        </Box>
      )}

      {search && results.length === 0 && (
        <Box sx={{ px: 2, py: 2 }} data-testid="finder-empty">
          <Typography sx={{ fontWeight: 700 }}>
            {debouncedQuery
              ? `Keine Tour passt zu „${debouncedQuery}“.`
              : 'Keine Tour passt zur Auswahl.'}
          </Typography>
          <Stack sx={{ mt: 1, gap: 1, alignItems: 'flex-start' }}>
            {bounds && (
              <Button
                variant="outlined"
                onClick={() => setInView('0')}
                sx={{ minHeight: 44, textTransform: 'none' }}
              >
                Überall suchen, nicht nur im Kartenausschnitt
              </Button>
            )}
            {hiddenByFilters > 0 && (
              <Typography variant="body2" color="text.secondary">
                {hiddenByFilters}{' '}
                {hiddenByFilters === 1 ? 'Tour wird' : 'Touren werden'} durch
                Filter ausgeblendet.
              </Typography>
            )}
            {debouncedQuery && (
              <Typography variant="body2" color="text.secondary">
                Gesucht wird in Tourname, Ort und Land. Andere Schreibweise oder
                kürzeren Begriff versuchen.
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {results.length > 0 && (
        <List aria-label="Gefundene Touren" sx={{ pt: 1 }}>
          {results.slice(0, limit).map((area) => {
            const shortId = shortIdOfArea(area);
            return (
              <ResultRow
                key={shortId}
                area={area}
                favorite={sets.favorites.has(shortId)}
                visited={sets.visited.has(shortId)}
                onOpen={() => void openTourOnMap(area, back)}
                onHover={
                  mobile
                    ? undefined
                    : (on) =>
                        setPreview(
                          on
                            ? ({ center: [area.lon, area.lat] } as Feature)
                            : null,
                        )
                }
              />
            );
          })}
        </List>
      )}
      {results.length > limit && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setLimit((value) => value + PAGE)}
            sx={{ minHeight: 48, textTransform: 'none' }}
          >
            Weitere {Math.min(PAGE, results.length - limit)} von{' '}
            {(results.length - limit).toLocaleString('de-DE')} anzeigen
          </Button>
        </Box>
      )}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        resultLabel={
          search
            ? `${results.length.toLocaleString('de-DE')} ${
                results.length === 1 ? 'Tour' : 'Touren'
              }`
            : undefined
        }
      />
    </Box>
  );
};

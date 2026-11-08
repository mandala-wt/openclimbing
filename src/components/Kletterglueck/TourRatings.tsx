import { Box, Rating, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { getShortId } from '../../services/helpers';
import type { Feature } from '../../services/types';
import { usePersonalData } from '../utils/PersonalDataContext';

type FamilySummary =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'error' }
  | {
      state: 'ok';
      tours: {
        id: string;
        name: string;
        count: number;
        average: number | null;
      }[];
    };

/** Reads the central family ratings for this OSM object, if configured. */
const useFamilyRatings = (osmRef: string | null): FamilySummary => {
  const [summary, setSummary] = useState<FamilySummary>({ state: 'loading' });
  useEffect(() => {
    if (!osmRef) {
      setSummary({ state: 'unavailable' });
      return undefined;
    }
    const controller = new AbortController();
    setSummary({ state: 'loading' });
    fetch(
      `/api/kletterglueck/ratings?summary=1&osm=${encodeURIComponent(osmRef)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (response.status === 503 || response.status === 404) {
          return { state: 'unavailable' } as const;
        }
        if (!response.ok) return { state: 'error' } as const;
        const body = await response.json();
        return { state: 'ok', tours: body.tours ?? [] } as const;
      })
      .then((next) => {
        if (!controller.signal.aborted) setSummary(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSummary({ state: 'error' });
      });
    return () => controller.abort();
  }, [osmRef]);
  return summary;
};

const SourceBox = ({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) => (
  <Box
    sx={{
      border: 1,
      borderColor: 'divider',
      borderRadius: 2,
      p: 1.5,
    }}
  >
    <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
    <Typography variant="caption" color="text.secondary" component="div">
      Quelle: {source}
    </Typography>
    <Box sx={{ mt: 1 }}>{children}</Box>
  </Box>
);

const formatAverage = (value: number) =>
  value.toLocaleString('de-DE', { maximumFractionDigits: 1 });

const FamilyRatings = ({ feature }: { feature: Feature }) => {
  const { type, id } = feature.osmMeta;
  const osmRef = type === 'way' || type === 'relation' ? `${type}/${id}` : null;
  const summary = useFamilyRatings(osmRef);
  let body: React.ReactNode;
  if (summary.state === 'loading') {
    body = <Typography variant="body2">Wird geladen …</Typography>;
  } else if (summary.state === 'unavailable') {
    body = (
      <Typography variant="body2" color="text.secondary">
        Der zentrale Tourenspeicher ist hier nicht eingerichtet.
      </Typography>
    );
  } else if (summary.state === 'error') {
    body = (
      <Typography variant="body2" color="error">
        Familienbewertungen sind gerade nicht erreichbar.
      </Typography>
    );
  } else if (!summary.tours.some((tour) => tour.count > 0)) {
    body = (
      <Typography variant="body2" color="text.secondary">
        Noch keine Familienbewertung für diese Tour.
      </Typography>
    );
  } else {
    body = summary.tours
      .filter((tour) => tour.count > 0)
      .map((tour) => (
        <Stack
          key={tour.id}
          direction="row"
          sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
        >
          <Rating value={tour.average} precision={0.5} readOnly />
          <Typography sx={{ fontWeight: 700 }}>
            {formatAverage(tour.average!)} von 5
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tour.count} {tour.count === 1 ? 'Bewertung' : 'Bewertungen'}
            {summary.tours.length > 1 ? ` · ${tour.name}` : ''}
          </Typography>
        </Stack>
      ));
  }
  return (
    <SourceBox
      title="Familienbewertung"
      source="zentraler Kletterglück-Tourenspeicher (für beide Geräte)"
    >
      {body}
    </SourceBox>
  );
};

const MyRating = ({ feature }: { feature: Feature }) => {
  const shortId = getShortId(feature.osmMeta);
  const { store } = usePersonalData();
  const stars = store.entries[shortId]?.stars ?? null;
  return (
    <SourceBox
      title="Meine Bewertung"
      source="nur auf diesem Gerät gespeichert"
    >
      {stars ? (
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Rating value={stars} readOnly />
          <Typography sx={{ fontWeight: 700 }}>{stars} von 5</Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Noch nicht bewertet. Sterne unter „Meine Notizen“ vergeben.
        </Typography>
      )}
    </SourceBox>
  );
};

export const TourRatings = ({ feature }: { feature: Feature }) => (
  <Stack sx={{ gap: 1 }} data-testid="tour-ratings">
    <MyRating feature={feature} />
    <FamilyRatings feature={feature} />
    <Typography variant="caption" color="text.secondary">
      Bewertungen verschiedener Quellen werden nicht verrechnet. Fremde
      Bewertungsportale sind nicht eingebunden, weil keine Freigabe für die
      Übernahme vorliegt.
    </Typography>
  </Stack>
);

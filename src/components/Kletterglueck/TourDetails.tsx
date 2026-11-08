import { Box, Divider, Link, Stack, Typography } from '@mui/material';
import React from 'react';
import { getCountryName } from '../../services/getCountryFlag';
import { getShortId } from '../../services/helpers';
import { getFerrataMeasure } from '../../services/tagging/ferrataMeasures';
import {
  describeViaFerrataScale,
  isViaFerrataTags,
} from '../../services/tagging/viaFerrataScale';
import type { Feature } from '../../services/types';
import { useFeatureContext } from '../utils/FeatureContext';
import { useFerrataCatalog } from './hooks';
import {
  formatAltitude,
  formatDate,
  formatMetres,
  formatMinutes,
  MISSING,
  parseOsmDuration,
} from './format';
import { TourRatings } from './TourRatings';
import { PersonalNotes } from './PersonalNotes';
import { TourTracks } from './TourTracks';
import { TourMedia } from './TourMedia';

export const Section = ({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) => (
  <Box component="section" aria-labelledby={id} sx={{ mb: 2.5 }}>
    <Typography
      id={id}
      component="h2"
      sx={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'text.secondary',
        mb: 1,
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

const Fact = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" component="div">
      {label}
    </Typography>
    <Typography
      sx={{
        fontWeight: value === MISSING ? 400 : 700,
        color: value === MISSING ? 'text.secondary' : 'text.primary',
        fontStyle: value === MISSING ? 'italic' : 'normal',
        overflowWrap: 'anywhere',
      }}
    >
      {value}
    </Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary" component="div">
        {hint}
      </Typography>
    )}
  </Box>
);

const scaleOf = (feature: Feature, catalogScale?: string | null) =>
  feature.tags.via_ferrata_scale?.trim() || catalogScale || null;

/** Summary of the facts we really have for a via ferrata. */
const TourFacts = ({ feature }: { feature: Feature }) => {
  const shortId = getShortId(feature.osmMeta);
  const { data } = useFerrataCatalog();
  const entry = data?.index.byShortId.get(shortId);
  const measure = getFerrataMeasure(feature.osmMeta.id);
  const city =
    entry?.city ||
    feature.tags['addr:city'] ||
    feature.tags['is_in:city'] ||
    null;
  const countryCode = entry?.countryCode ?? feature.countryCode ?? null;
  const duration = parseOsmDuration(feature.tags.duration);
  const scale = scaleOf(feature, entry?.viaFerrataScale);

  return (
    <Box
      data-testid="tour-facts"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 1.5,
      }}
    >
      <Fact label="Ort" value={city || MISSING} />
      <Fact
        label="Land"
        value={countryCode ? getCountryName(countryCode, 'de') : MISSING}
      />
      <Fact
        label="Schwierigkeit"
        value={
          scale
            ? (() => {
                const label = describeViaFerrataScale(scale);
                return label ? `${label.letter} (Skala ${scale})` : scale;
              })()
            : MISSING
        }
        hint={
          feature.tags.via_ferrata_scale
            ? 'OSM-Wert'
            : entry?.viaFerrataScale
              ? 'aus dem Klettersteig-Katalog'
              : undefined
        }
      />
      <Fact
        label="Dauer"
        value={
          duration !== null
            ? formatMinutes(duration)
            : feature.tags.duration || MISSING
        }
      />
      <Fact
        label="Länge der Linie"
        value={formatMetres(measure?.lengthM)}
        hint={measure ? 'aus OSM-Geometrie' : undefined}
      />
      <Fact
        label="Luftlinie Anfang–Ende"
        value={formatMetres(measure?.spanM)}
      />
      <Fact
        label="Höhenlage"
        value={formatAltitude(measure?.eleM)}
        hint={measure?.eleM != null ? 'Index, Bezugspunkt offen' : undefined}
      />
      <Fact label="Höhenmeter" value={MISSING} />
    </Box>
  );
};

const TourSource = ({ feature }: { feature: Feature }) => {
  const { type, id } = feature.osmMeta;
  const hasMeasure = Boolean(getFerrataMeasure(id));
  return (
    <Stack sx={{ gap: 0.5 }}>
      <Typography variant="body2">
        Daten:{' '}
        <Link
          href={`https://www.openstreetmap.org/${type}/${id}`}
          target="_blank"
          rel="noopener"
        >
          OpenStreetMap
        </Link>{' '}
        (© OpenStreetMap-Mitwirkende, ODbL)
        {feature.osmMeta.timestamp
          ? `, zuletzt geändert am ${formatDate(feature.osmMeta.timestamp)}`
          : ''}
        .
      </Typography>
      {hasMeasure && (
        <Typography variant="body2" color="text.secondary">
          Länge, Luftlinie und Höhenlage stammen aus einem einmalig aus der
          OSM-Geometrie berechneten Index (Nov. 2026), nicht aus einer Begehung.
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        Keine Angaben zu Sperrungen, Wetter oder Zustand. Vor der Tour aktuelle
        Quellen prüfen.
      </Typography>
    </Stack>
  );
};

/** Kletterglück details for a via ferrata, shown in the feature panel. */
export const TourDetails = () => {
  const { feature } = useFeatureContext();
  if (
    !feature ||
    feature.skeleton ||
    feature.point ||
    !feature.osmMeta?.id ||
    !isViaFerrataTags(feature.tags)
  ) {
    return null;
  }
  return (
    <Box data-testid="tour-details" sx={{ mt: 1 }}>
      <Section title="Steckbrief" id="tour-facts-heading">
        <TourFacts feature={feature} />
      </Section>
      <Section title="Herkunft der Daten" id="tour-source-heading">
        <TourSource feature={feature} />
      </Section>
      <Divider sx={{ mb: 2 }} />
      <Section title="Bewertungen" id="tour-ratings-heading">
        <TourRatings feature={feature} />
      </Section>
      <Section title="Meine Notizen" id="tour-notes-heading">
        <PersonalNotes feature={feature} />
      </Section>
      <Section title="Tracks und GPX" id="tour-tracks-heading">
        <TourTracks feature={feature} />
      </Section>
      <TourMedia feature={feature} />
    </Box>
  );
};

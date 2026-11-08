import styled from '@emotion/styled';
import { Skeleton, Typography } from '@mui/material';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { getCountryFlag } from '../../services/getCountryFlag';
import { intl, t } from '../../services/intl';
import {
  ClimbingArea,
  getClimbingAreas,
} from '../../services/climbing-areas/getClimbingAreas';
import type { ClimbingListType } from '../../services/climbing-areas/climbingListTypes';
import { Feature, TranslationId } from '../../services/types';
import { useFeatureContext } from '../utils/FeatureContext';
import { Bbox } from '../utils/MapStateContext';
import { tint } from '../utils/panelUi';
import { ViaFerrataScaleChip } from '../utils/ViaFerrataScaleChip';
import { useVisibleBbox } from '../utils/useVisibleBbox';
import { fetchReverseCity } from '../../services/reverseGeocodeCity';
import { GalleryWrapper } from './HomepageOpenClimbingGallery';
import {
  loadViaFerrataIndex,
  matchViaFerrataClimb,
  ViaFerrataIndexRow,
} from '../../services/viaFerrata/catalog';

const LIMIT = 24;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
`;

const Card = styled(Link)`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  background: ${({ theme }) => tint(theme, 0.03)};
  border: 1px solid ${({ theme }) => tint(theme, 0.12)};
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover,
  &:focus {
    text-decoration: none;
    background: ${({ theme }) => tint(theme, 0.07)};
  }
`;

const Flag = styled.span`
  flex-shrink: 0;
  font-size: 1.2em;
  line-height: 1;
`;

const City = styled.span`
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  line-height: 1.3;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const SortToggle = styled.button`
  justify-self: start;
  border: 0;
  background: transparent;
  padding: 0 4px 4px;
  cursor: pointer;
  font-size: 12px;
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const FallbackNote = styled.p`
  margin: 0 0 8px;
  padding: 0 4px;
  color: ${({ theme }) => theme.palette.text.secondary};
  font-size: 12px;
  line-height: 1.4;
`;

const COPY: Record<
  Exclude<ClimbingListType, 'rock'>,
  {
    fallback: TranslationId;
    empty: TranslationId;
  }
> = {
  ferrata: {
    fallback: 'homepage.gallery.nothing_in_viewport_ferrata',
    empty: 'climbingareas.no_ferratas',
  },
  gym: {
    fallback: 'homepage.gallery.nothing_in_viewport_gym',
    empty: 'climbingareas.no_gyms',
  },
};

const isInViewport = (item: ClimbingArea, bbox: Bbox) => {
  const [west, north, east, south] = bbox;
  return (
    item.lon >= west &&
    item.lon <= east &&
    item.lat >= south &&
    item.lat <= north
  );
};

const poiKey = (item: ClimbingArea) => `${item.osmType}/${item.osmId}`;

const useVisibleItems = (listType: Exclude<ClimbingListType, 'rock'>) => {
  const bbox = useVisibleBbox();
  const { data, isLoading } = useQuery(
    ['climbingAreas', listType],
    () => getClimbingAreas(listType),
    { staleTime: 1000 * 60 * 60 },
  );

  return useMemo(() => {
    const all = data ?? [];
    const inViewport = bbox
      ? all.filter((item) => isInViewport(item, bbox))
      : all;
    const isFallback = inViewport.length === 0;
    return {
      items: (isFallback ? all : inViewport).slice(0, LIMIT),
      isFallback: isFallback && all.length > 0 && !!bbox,
      isLoading,
    };
  }, [data, bbox, isLoading]);
};

const useGymCities = (
  listType: Exclude<ClimbingListType, 'rock'>,
  items: ClimbingArea[],
) => {
  const missing = listType === 'gym' ? items.filter((item) => !item.city) : [];
  const missingKey = missing.map(poiKey).join(',');
  const { data: extraCities } = useQuery(
    ['gym-reverse-city', missingKey],
    async () => {
      const entries = await Promise.all(
        missing.map(async (item) => {
          try {
            return [
              poiKey(item),
              await fetchReverseCity(item.lon, item.lat),
            ] as const;
          } catch {
            return [poiKey(item), null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
    { enabled: missing.length > 0, staleTime: Infinity },
  );

  if (!extraCities) return items;
  return items.map((item) =>
    item.city ? item : { ...item, city: extraCities[poiKey(item)] ?? null },
  );
};

const PoiCard = ({
  item,
  rating,
}: {
  item: ClimbingArea;
  rating?: ViaFerrataIndexRow | null;
}) => {
  const { setPreview } = useFeatureContext();
  const name = item.name || `N/A – ${item.osmType}/${item.osmId}`;

  return (
    <Card
      href={`/${item.osmType}/${item.osmId}`}
      locale={intl.lang}
      title={name}
      onMouseEnter={() =>
        setPreview({ center: [item.lon, item.lat] } as Feature)
      }
      onMouseLeave={() => setPreview(null)}
    >
      <Flag>{getCountryFlag(item.countryCode) || '🏳️'}</Flag>
      <Typography
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.85rem',
          fontWeight: 700,
          lineHeight: 1.3,
        }}
      >
        {name}
      </Typography>
      {item.viaFerrataScale && (
        <ViaFerrataScaleChip scale={item.viaFerrataScale} />
      )}
      {rating && rating.count > 0 && (
        <City title={`${rating.count} Bewertungen`}>
          {rating.average.toLocaleString('de-DE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </City>
      )}
      {item.city && <City title={item.city}>{item.city}</City>}
    </Card>
  );
};

export const HomepageNearbyPoiList = ({
  listType,
}: {
  listType: Exclude<ClimbingListType, 'rock'>;
}) => {
  const { items, isFallback, isLoading } = useVisibleItems(listType);
  const itemsWithCity = useGymCities(listType, items);
  const copy = COPY[listType];
  const [byRating, setByRating] = useState(false);
  const [index, setIndex] = useState<ViaFerrataIndexRow[] | null>(null);

  useEffect(() => {
    if (listType !== 'ferrata') return undefined;
    let cancelled = false;
    loadViaFerrataIndex()
      .then((rows) => {
        if (!cancelled) setIndex(rows);
      })
      .catch(() => {
        if (!cancelled) setIndex([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listType]);

  const ratingOf = (name: string) =>
    index && name ? matchViaFerrataClimb(name, index) : null;

  const shown = useMemo(() => {
    if (listType !== 'ferrata' || !byRating || !index) return itemsWithCity;
    return [...itemsWithCity].sort((a, b) => {
      const left = matchViaFerrataClimb(a.name || '', index)?.average ?? -1;
      const right = matchViaFerrataClimb(b.name || '', index)?.average ?? -1;
      return right - left;
    });
  }, [byRating, index, itemsWithCity, listType]);

  return (
    <GalleryWrapper>
      {isLoading && (
        <Grid>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              variant="rounded"
              height={42}
            />
          ))}
        </Grid>
      )}
      {!isLoading && isFallback && (
        <FallbackNote>{t(copy.fallback)}</FallbackNote>
      )}
      {!isLoading && items.length === 0 && (
        <FallbackNote>{t(copy.empty)}</FallbackNote>
      )}
      {!isLoading && items.length > 0 && (
        <Grid>
          {listType === 'ferrata' && (
            <SortToggle
              type="button"
              onClick={() => setByRating((value) => !value)}
            >
              {byRating ? 'Nach Karte' : 'Nach Bewertung'}
            </SortToggle>
          )}
          {shown.map((item) => (
            <PoiCard
              key={`${item.osmType}-${item.osmId}`}
              item={item}
              rating={listType === 'ferrata' ? ratingOf(item.name || '') : null}
            />
          ))}
        </Grid>
      )}
    </GalleryWrapper>
  );
};

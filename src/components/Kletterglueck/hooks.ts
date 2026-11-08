import { useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import { loadFerrataCatalog } from '../../services/kletterglueck/ferrataCatalog';
import {
  FAVORITES_ID,
  VISITED_ID,
} from '../../services/my-lists/localFerrataLists';
import type {
  PersonalSets,
  TourFilter,
} from '../../services/kletterglueck/tourSearch';
import { useMyListsContext } from '../utils/MyListsContext';
import { useUserSettingsContext } from '../utils/userSettings/UserSettingsContext';
import { updateMapPersonalLists } from '../utils/userSettings/mapClimbingFilter';

export const FERRATA_CATALOG_QUERY = ['kletterglueck', 'ferrata-catalog'];

/** Shared catalog (react-query on top of the module cache). */
export const useFerrataCatalog = () =>
  useQuery(FERRATA_CATALOG_QUERY, loadFerrataCatalog, {
    staleTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

export const usePersonalSets = (): PersonalSets => {
  const { lists } = useMyListsContext();
  return useMemo(() => {
    const ids = (id: number) =>
      new Set(
        lists
          ?.find((list) => list.id === id)
          ?.items.map(({ shortId }) => shortId) ?? [],
      );
    return { favorites: ids(FAVORITES_ID), visited: ids(VISITED_ID) };
  }, [lists]);
};

/** Keeps the map filter in sync with the local favourites/visited lists. */
export const MapPersonalListsSync = () => {
  const sets = usePersonalSets();
  useEffect(() => {
    updateMapPersonalLists(sets);
  }, [sets]);
  return null;
};

export const useTourFilter = (): TourFilter => {
  const filter = useUserSettingsContext().climbingFilter;
  return useMemo(
    () => ({
      ferrataGrades: filter.ferrataGrades,
      ferrataCountries: filter.ferrataCountries,
      lengthInterval: filter.ferrataLengthInterval,
      spanInterval: filter.ferrataSpanInterval,
      eleInterval: filter.ferrataEleInterval,
      isLengthDefault: filter.isFerrataLengthDefault,
      isSpanDefault: filter.isFerrataSpanDefault,
      isEleDefault: filter.isFerrataEleDefault,
      personal: filter.ferrataPersonal,
    }),
    [
      filter.ferrataGrades,
      filter.ferrataCountries,
      filter.ferrataLengthInterval,
      filter.ferrataSpanInterval,
      filter.ferrataEleInterval,
      filter.isFerrataLengthDefault,
      filter.isFerrataSpanDefault,
      filter.isFerrataEleDefault,
      filter.ferrataPersonal,
    ],
  );
};

import {
  ALL_FERRATA_GRADES,
  FerrataGrade,
} from '../../../services/tagging/ferrataGradeFilter';
import { GradeSystem } from '../../../services/tagging/climbing/gradeSystems';
import isEqual from 'lodash/isEqual';
import { Interval, PhotoDrawnFilter, PoiTypes } from './getClimbingFilter';
import { DEFAULT_LENGTH_INTERVAL } from '../../../services/tagging/climbing/parseClimbingLength';
import {
  DEFAULT_FERRATA_ELE_INTERVAL,
  DEFAULT_FERRATA_LENGTH_INTERVAL,
  DEFAULT_FERRATA_SPAN_INTERVAL,
} from '../../../services/tagging/ferrataMeasures';
import {
  EMPTY_PERSONAL_SETS,
  PersonalFilter,
  PersonalSets,
} from '../../../services/kletterglueck/tourSearch';

export type MapClimbingFilterState = {
  ferrataGrades: FerrataGrade[];
  userSystem: GradeSystem | undefined;
  gradeInterval: Interval | undefined;
  minimumRoutes: number | undefined;
  poiTypes: PoiTypes | undefined;
  climbingTypes: string[];
  inclinations: string[];
  materials: string[];
  familyFriendly: boolean;
  photoDrawn: PhotoDrawnFilter;
  lengthInterval: Interval;
  ferrataCountries: string[];
  ferrataLengthInterval: Interval;
  ferrataSpanInterval: Interval;
  ferrataEleInterval: Interval;
  ferrataPersonal: PersonalFilter;
  isDefaultFilter: boolean;
  isGradeIntervalDefault: boolean;
  isMinimumRoutesDefault: boolean;
  isLengthIntervalDefault: boolean;
  isFerrataCountriesDefault: boolean;
  isFerrataLengthDefault: boolean;
  isFerrataSpanDefault: boolean;
  isFerrataEleDefault: boolean;
};

export const mapClimbingFilter: MapClimbingFilterState & {
  callback: () => void;
} = {
  ferrataGrades: ALL_FERRATA_GRADES,
  userSystem: undefined,
  gradeInterval: undefined,
  minimumRoutes: undefined,
  poiTypes: undefined,
  climbingTypes: [],
  inclinations: [],
  materials: [],
  familyFriendly: false,
  photoDrawn: 'any',
  lengthInterval: DEFAULT_LENGTH_INTERVAL,
  ferrataCountries: [],
  ferrataLengthInterval: DEFAULT_FERRATA_LENGTH_INTERVAL,
  ferrataSpanInterval: DEFAULT_FERRATA_SPAN_INTERVAL,
  ferrataEleInterval: DEFAULT_FERRATA_ELE_INTERVAL,
  ferrataPersonal: 'all',
  isDefaultFilter: false,
  isGradeIntervalDefault: true,
  isMinimumRoutesDefault: true,
  isLengthIntervalDefault: true,
  isFerrataCountriesDefault: true,
  isFerrataLengthDefault: true,
  isFerrataSpanDefault: true,
  isFerrataEleDefault: true,
  callback: () => {},
};

export const updateMapFilter = (next: MapClimbingFilterState) => {
  if (
    !isEqual(mapClimbingFilter.ferrataGrades, next.ferrataGrades) ||
    mapClimbingFilter.userSystem != next.userSystem ||
    !isEqual(mapClimbingFilter.gradeInterval, next.gradeInterval) ||
    mapClimbingFilter.minimumRoutes != next.minimumRoutes ||
    !isEqual(mapClimbingFilter.poiTypes, next.poiTypes) ||
    !isEqual(mapClimbingFilter.climbingTypes, next.climbingTypes) ||
    !isEqual(mapClimbingFilter.inclinations, next.inclinations) ||
    !isEqual(mapClimbingFilter.materials, next.materials) ||
    mapClimbingFilter.familyFriendly != next.familyFriendly ||
    mapClimbingFilter.photoDrawn != next.photoDrawn ||
    !isEqual(mapClimbingFilter.lengthInterval, next.lengthInterval) ||
    !isEqual(mapClimbingFilter.ferrataCountries, next.ferrataCountries) ||
    !isEqual(
      mapClimbingFilter.ferrataLengthInterval,
      next.ferrataLengthInterval,
    ) ||
    !isEqual(mapClimbingFilter.ferrataSpanInterval, next.ferrataSpanInterval) ||
    !isEqual(mapClimbingFilter.ferrataEleInterval, next.ferrataEleInterval) ||
    mapClimbingFilter.ferrataPersonal !== next.ferrataPersonal
  ) {
    Object.assign(mapClimbingFilter, next);
    mapClimbingFilter.callback();
  }
};

/**
 * Favourites and visited ferratas live in MyListsContext, not in the user
 * settings. `MapPersonalListsSync` keeps this copy for the map filter.
 */
export const mapPersonalLists: { sets: PersonalSets } = {
  sets: EMPTY_PERSONAL_SETS,
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((value) => b.has(value));

export const updateMapPersonalLists = (sets: PersonalSets) => {
  const previous = mapPersonalLists.sets;
  if (
    sameSet(previous.favorites, sets.favorites) &&
    sameSet(previous.visited, sets.visited)
  ) {
    return;
  }
  mapPersonalLists.sets = sets;
  if (mapClimbingFilter.ferrataPersonal !== 'all') {
    mapClimbingFilter.callback();
  }
};

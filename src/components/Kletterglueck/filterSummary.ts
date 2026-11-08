import { getCountryName } from '../../services/getCountryFlag';
import {
  ALL_FERRATA_GRADES,
  FerrataGrade,
} from '../../services/tagging/ferrataGradeFilter';
import {
  FERRATA_ELE_MAX_M,
  FERRATA_LENGTH_MAX_M,
  FERRATA_SPAN_MAX_M,
} from '../../services/tagging/ferrataMeasures';
import type { PersonalFilter } from '../../services/kletterglueck/tourSearch';
import type { ClimbingFilter } from '../utils/userSettings/getClimbingFilter';

export const PERSONAL_LABELS: Record<PersonalFilter, string> = {
  all: 'Alle',
  favorites: 'Favoriten',
  visited: 'Besucht',
  notVisited: 'Noch nicht besucht',
};

export type ActiveFilter = {
  key: string;
  label: string;
  reset: () => void;
};

const range = ([min, max]: [number, number], openMax: number, unit = 'm') => {
  const fmt = (value: number) => value.toLocaleString('de-DE');
  if (max >= openMax) return `ab ${fmt(min)} ${unit}`;
  if (min <= 0) return `bis ${fmt(max)} ${unit}`;
  return `${fmt(min)}–${fmt(max)} ${unit}`;
};

const gradeLabel = (grades: readonly FerrataGrade[]) =>
  ALL_FERRATA_GRADES.filter((grade) => grades.includes(grade))
    .map((grade) => (grade === 'unknown' ? 'unbekannt' : grade))
    .join(', ') || 'keiner';

type Input = Pick<
  ClimbingFilter,
  | 'ferrataGrades'
  | 'setFerrataGrades'
  | 'ferrataCountries'
  | 'setFerrataCountries'
  | 'ferrataLengthInterval'
  | 'setFerrataLengthInterval'
  | 'isFerrataLengthDefault'
  | 'ferrataSpanInterval'
  | 'setFerrataSpanInterval'
  | 'isFerrataSpanDefault'
  | 'ferrataEleInterval'
  | 'setFerrataEleInterval'
  | 'isFerrataEleDefault'
  | 'ferrataPersonal'
  | 'setFerrataPersonal'
  | 'poiTypes'
  | 'setPoiTypes'
  | 'isPoiTypesDefault'
>;

/** Human readable list of the active via ferrata filters. */
export const activeFilters = (filter: Input): ActiveFilter[] => {
  const result: ActiveFilter[] = [];
  if (filter.ferrataPersonal !== 'all') {
    result.push({
      key: 'personal',
      label: `Nur ${PERSONAL_LABELS[filter.ferrataPersonal]}`,
      reset: () => filter.setFerrataPersonal('all'),
    });
  }
  if (!ALL_FERRATA_GRADES.every((g) => filter.ferrataGrades.includes(g))) {
    result.push({
      key: 'grades',
      label: `Grad: ${gradeLabel(filter.ferrataGrades)}`,
      reset: () => filter.setFerrataGrades(ALL_FERRATA_GRADES),
    });
  }
  if (filter.ferrataCountries.length) {
    result.push({
      key: 'countries',
      label: `Land: ${filter.ferrataCountries
        .map((code) => getCountryName(code, 'de'))
        .join(', ')}`,
      reset: () => filter.setFerrataCountries([]),
    });
  }
  if (!filter.isFerrataLengthDefault) {
    result.push({
      key: 'length',
      label: `Länge ${range(filter.ferrataLengthInterval, FERRATA_LENGTH_MAX_M)}`,
      reset: () => filter.setFerrataLengthInterval([0, FERRATA_LENGTH_MAX_M]),
    });
  }
  if (!filter.isFerrataSpanDefault) {
    result.push({
      key: 'span',
      label: `Weite ${range(filter.ferrataSpanInterval, FERRATA_SPAN_MAX_M)}`,
      reset: () => filter.setFerrataSpanInterval([0, FERRATA_SPAN_MAX_M]),
    });
  }
  if (!filter.isFerrataEleDefault) {
    result.push({
      key: 'ele',
      label: `Höhe ${range(filter.ferrataEleInterval, FERRATA_ELE_MAX_M, 'm ü. M.')}`,
      reset: () => filter.setFerrataEleInterval([0, FERRATA_ELE_MAX_M]),
    });
  }
  if (!filter.isPoiTypesDefault) {
    const shown = [
      filter.poiTypes.ferrata && 'Klettersteige',
      filter.poiTypes.rock && 'Klettergebiete',
      filter.poiTypes.gym && 'Hallen',
    ].filter(Boolean);
    result.push({
      key: 'types',
      label: `Karte zeigt: ${shown.join(', ') || 'nichts'}`,
      reset: () =>
        filter.setPoiTypes({ rock: true, ferrata: true, gym: false }),
    });
  }
  return result;
};

export const UNKNOWN_VALUES_NOTE =
  'Fehlende Angaben werden nicht geschätzt. Ohne Grad zählt eine Tour als „Unbekannt“. ' +
  'Mit Länderauswahl fehlen Touren ohne bekanntes Land. ' +
  'Touren ohne gemessene Linie bleiben bei Länge, Weite und Höhe sichtbar.';

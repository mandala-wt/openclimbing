import {
  formatAltitude,
  formatDate,
  formatMetres,
  formatMinutes,
  MISSING,
  parseOsmDuration,
} from '../format';

test('missing values differ from real zeros', () => {
  expect(formatMetres(undefined)).toBe(MISSING);
  expect(formatMetres(null)).toBe(MISSING);
  expect(formatMetres(NaN)).toBe(MISSING);
  expect(formatMetres(0)).toBe('0 m');
  expect(formatAltitude(0)).toBe('0 m ü. M.');
  expect(formatAltitude(null)).toBe(MISSING);
  expect(formatMinutes(0)).toBe('0 min');
  expect(formatMinutes(undefined)).toBe(MISSING);
});

test('formats lengths, durations and dates in German', () => {
  expect(formatMetres(450)).toBe('450 m');
  expect(formatMetres(3520)).toBe('3,52 km');
  expect(formatMinutes(180)).toBe('3 h');
  expect(formatMinutes(95)).toBe('1 h 35 min');
  expect(formatDate('2026-05-14T09:12:00Z')).toBe('14. Mai 2026');
  expect(formatDate('2026-07-01')).toBe('1. Juli 2026');
  expect(formatDate('kaputt')).toBe(MISSING);
});

test('reads common OSM duration formats and leaves others unknown', () => {
  expect(parseOsmDuration('PT3H')).toBe(180);
  expect(parseOsmDuration('PT1H30M')).toBe(90);
  expect(parseOsmDuration('03:30')).toBe(210);
  expect(parseOsmDuration('2-3 Stunden')).toBeNull();
  expect(parseOsmDuration(undefined)).toBeNull();
});

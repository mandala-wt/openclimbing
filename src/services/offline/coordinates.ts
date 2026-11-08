import { isFiniteNumber } from './geo';

const pad = (value: number, width: number) =>
  value.toFixed(2).padStart(width, '0');

export const formatDecimal = (lat: number, lon: number): string =>
  `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

export const formatAxisDms = (
  value: number,
  positive: string,
  negative: string,
): string => {
  const hemisphere = value >= 0 ? positive : negative;
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return `${degrees}° ${String(minutes).padStart(2, '0')}′ ${pad(seconds, 5)}″ ${hemisphere}`;
};

export const formatDms = (lat: number, lon: number): string =>
  `${formatAxisDms(lat, 'N', 'S')}, ${formatAxisDms(lon, 'O', 'W')}`;

export type PositionFormats = {
  decimal: string;
  dms: string;
  plusCode: string | null;
  mgrs: string | null;
};

type Encoders = {
  plusCode?: (lat: number, lon: number) => string | null;
  mgrs?: (lat: number, lon: number) => string | null;
};

let encoders: Encoders = {};

/** Optional. Called once from the browser bundle; tests can inject fakes. */
export const setCoordinateEncoders = (next: Encoders) => {
  encoders = next;
};

export const formatPosition = (lat: number, lon: number): PositionFormats => ({
  decimal: formatDecimal(lat, lon),
  dms: formatDms(lat, lon),
  plusCode: encoders.plusCode?.(lat, lon) ?? null,
  mgrs: encoders.mgrs?.(lat, lon) ?? null,
});

export const readFinite = (value: unknown): number | null =>
  isFiniteNumber(value) ? value : null;

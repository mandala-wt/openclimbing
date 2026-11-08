/** Missing values stay "keine Angabe"; 0 is shown as 0. */
export const MISSING = 'keine Angabe';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const formatMetres = (value: number | null | undefined) => {
  if (!isNumber(value)) return MISSING;
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('de-DE', {
      maximumFractionDigits: 2,
    })} km`;
  }
  return `${Math.round(value).toLocaleString('de-DE')} m`;
};

export const formatAltitude = (value: number | null | undefined) =>
  isNumber(value)
    ? `${Math.round(value).toLocaleString('de-DE')} m ü. M.`
    : MISSING;

export const formatMinutes = (value: number | null | undefined) => {
  if (!isNumber(value)) return MISSING;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
};

/** OSM `duration` is ISO-8601-ish ("PT3H", "3:00", "03:30"). Unknown formats stay raw. */
export const parseOsmDuration = (value: string | undefined): number | null => {
  const text = value?.trim();
  if (!text) return null;
  const iso = text.match(/^P(?:T)?(?:(\d+(?:\.\d+)?)H)?(?:(\d+)M)?$/i);
  if (iso && (iso[1] || iso[2])) {
    return Math.round(Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0));
  }
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+$/.test(text)) return Number(text);
  return null;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return MISSING;
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return MISSING;
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

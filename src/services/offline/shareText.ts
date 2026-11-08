import { formatPosition, PositionFormats } from './coordinates';

export type ShareFix = {
  lat: number;
  lon: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  timestamp: number;
};

const stamp = (timestamp: number): string =>
  new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp));

export const positionShareText = (
  fix: ShareFix,
  formats: PositionFormats = formatPosition(fix.lat, fix.lon),
): string => {
  const lines = [
    'Standort aus Kletterglück',
    `Dezimal: ${formats.decimal}`,
    `Grad Minuten Sekunden: ${formats.dms}`,
  ];
  if (formats.plusCode) lines.push(`Plus-Code: ${formats.plusCode}`);
  if (formats.mgrs) lines.push(`MGRS: ${formats.mgrs}`);
  if (fix.accuracy != null) {
    lines.push(`Genauigkeit der Ortung: ${Math.round(fix.accuracy)} m`);
  }
  if (fix.altitude != null) {
    const accuracy =
      fix.altitudeAccuracy != null
        ? ` (± ${Math.round(fix.altitudeAccuracy)} m)`
        : '';
    lines.push(`Höhe laut Ortung: ${Math.round(fix.altitude)} m${accuracy}`);
  }
  lines.push(`Zeitpunkt der letzten Ortung: ${stamp(fix.timestamp)}`);
  lines.push('Keine Aussage zu Wetter, Sperrung oder Begehbarkeit.');
  return lines.join('\n');
};

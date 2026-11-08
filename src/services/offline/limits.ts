import { TourPack } from './types';

export const MAX_OFFLINE_BYTES = 8 * 1024 * 1024;
export const MAX_OFFLINE_TOURS = 24;
export const MAX_OSM_DOCUMENT_BYTES = 1_500_000;

const utf8Length = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
};

export const jsonUtf8Bytes = (value: unknown): number =>
  utf8Length(JSON.stringify(value));

export const usedBytes = (packs: TourPack[]): number =>
  packs.reduce((sum, pack) => sum + pack.bytes, 0);

export type QuotaProblem = 'count' | 'bytes';

export const quotaProblem = (
  existing: TourPack[],
  next: TourPack,
): QuotaProblem | null => {
  const others = existing.filter((pack) => pack.id !== next.id);
  if (others.length + 1 > MAX_OFFLINE_TOURS) return 'count';
  if (usedBytes(others) + next.bytes > MAX_OFFLINE_BYTES) return 'bytes';
  return null;
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

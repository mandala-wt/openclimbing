export type TrackPoint = [longitude: number, latitude: number];
export type TrackSegment = TrackPoint[];

export type ParsedGpx = {
  name: string | null;
  segments: TrackSegment[];
  /** Segments with a single point or invalid coordinates that were skipped. */
  skippedSegments: number;
  skippedPoints: number;
  pointCount: number;
  lengthM: number;
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  /** Present when the file carried elevations for every kept point. */
  elevation: { minM: number; maxM: number; ascentM: number } | null;
};

export const MAX_GPX_BYTES = 5_000_000;
export const MAX_GPX_POINTS = 20_000;

const GPX_NAMESPACES = [
  'http://www.topografix.com/GPX/1/1',
  'http://www.topografix.com/GPX/1/0',
];

export class GpxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GpxError';
  }
}

const EARTH_DIAMETER_M = 12_742_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export const distanceM = (
  [lon1, lat1]: TrackPoint,
  [lon2, lat2]: TrackPoint,
) => {
  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return EARTH_DIAMETER_M * Math.asin(Math.sqrt(Math.min(1, a)));
};

export const trackLengthM = (segments: TrackSegment[]) =>
  segments.reduce(
    (sum, segment) =>
      sum +
      segment
        .slice(1)
        .reduce(
          (part, point, index) => part + distanceM(segment[index], point),
          0,
        ),
    0,
  );

const childElements = (parent: Element, localName: string) =>
  Array.from(parent.children).filter((child) => child.localName === localName);

const readNumber = (value: string | null | undefined) => {
  const text = value?.trim();
  if (!text) return NaN;
  return Number(text);
};

type RawPoint = { point: TrackPoint; ele: number | null } | null;

const readPoint = (element: Element): RawPoint => {
  const lat = readNumber(element.getAttribute('lat'));
  const lon = readNumber(element.getAttribute('lon'));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return null;
  }
  const eleElement = childElements(element, 'ele')[0];
  const ele = eleElement ? readNumber(eleElement.textContent) : NaN;
  return { point: [lon, lat], ele: Number.isFinite(ele) ? ele : null };
};

/**
 * Reads tracks (all <trk>/<trkseg>) and routes (<rte>) of GPX 1.0 and 1.1.
 * Timestamps, device names and author fields are ignored on purpose.
 */
export const parseGpx = (xml: string): ParsedGpx => {
  if (!xml.trim()) throw new GpxError('Die Datei ist leer.');
  if (xml.length > MAX_GPX_BYTES) {
    throw new GpxError('Die Datei ist größer als 5 MB.');
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new GpxError(
      'Die Datei ist beschädigt oder kein gültiges XML. Bitte die GPX-Datei erneut exportieren.',
    );
  }
  const root = doc.documentElement;
  if (root.localName !== 'gpx') {
    throw new GpxError('Das ist keine GPX-Datei.');
  }
  if (root.namespaceURI && !GPX_NAMESPACES.includes(root.namespaceURI)) {
    throw new GpxError('Unbekannte GPX-Version.');
  }

  const rawSegments: RawPoint[][] = [];
  for (const trk of childElements(root, 'trk')) {
    for (const seg of childElements(trk, 'trkseg')) {
      rawSegments.push(childElements(seg, 'trkpt').map(readPoint));
    }
  }
  for (const rte of childElements(root, 'rte')) {
    rawSegments.push(childElements(rte, 'rtept').map(readPoint));
  }
  if (!rawSegments.length) {
    throw new GpxError(
      'Die Datei enthält keinen Track und keine Route (nur Wegpunkte oder leer).',
    );
  }

  let skippedPoints = 0;
  let skippedSegments = 0;
  const segments: TrackSegment[] = [];
  const elevations: (number | null)[] = [];
  let pointCount = 0;
  for (const raw of rawSegments) {
    const valid = raw.filter((entry): entry is NonNullable<RawPoint> => {
      if (entry) return true;
      skippedPoints += 1;
      return false;
    });
    if (valid.length < 2) {
      skippedSegments += 1;
      skippedPoints += valid.length;
      continue;
    }
    pointCount += valid.length;
    if (pointCount > MAX_GPX_POINTS) {
      throw new GpxError(
        `Der Track hat mehr als ${MAX_GPX_POINTS.toLocaleString('de-DE')} Punkte. Bitte vorher vereinfachen.`,
      );
    }
    segments.push(valid.map(({ point }) => point));
    elevations.push(...valid.map(({ ele }) => ele));
  }
  if (!segments.length) {
    throw new GpxError(
      'Die Datei enthält keine verwendbaren Trackpunkte (mindestens zwei gültige Punkte je Abschnitt).',
    );
  }

  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const segment of segments) {
    for (const [lon, lat] of segment) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }

  let elevation: ParsedGpx['elevation'] = null;
  if (elevations.every((value) => value !== null)) {
    const values = elevations as number[];
    let ascentM = 0;
    let offset = 0;
    for (const segment of segments) {
      for (let i = 1; i < segment.length; i += 1) {
        const diff = values[offset + i] - values[offset + i - 1];
        if (diff > 0) ascentM += diff;
      }
      offset += segment.length;
    }
    elevation = {
      minM: Math.round(Math.min(...values)),
      maxM: Math.round(Math.max(...values)),
      ascentM: Math.round(ascentM),
    };
  }

  const metadataName = childElements(root, 'metadata')
    .flatMap((metadata) => childElements(metadata, 'name'))[0]
    ?.textContent?.trim();
  const trackName = [
    ...childElements(root, 'trk'),
    ...childElements(root, 'rte'),
  ]
    .flatMap((element) => childElements(element, 'name'))[0]
    ?.textContent?.trim();

  return {
    name: (trackName || metadataName || '').slice(0, 120) || null,
    segments,
    skippedSegments,
    skippedPoints,
    pointCount,
    lengthM: Math.round(trackLengthM(segments)),
    bounds: [west, south, east, north],
    elevation,
  };
};

const escapeXml = (text: string) =>
  text.replace(
    /[<>&'"]/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[char]!,
  );

export const serializeGpx = ({
  name,
  segments,
  creator = 'Kletterglück',
  description,
}: {
  name: string;
  segments: TrackSegment[];
  creator?: string;
  description?: string;
}) => {
  const body = segments
    .map(
      (segment) =>
        `    <trkseg>\n${segment
          .map(
            ([lon, lat]) =>
              `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"/>`,
          )
          .join('\n')}\n    </trkseg>`,
    )
    .join('\n');
  const desc = description
    ? `\n    <desc>${escapeXml(description)}</desc>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>${desc}
${body}
  </trk>
</gpx>
`;
};

export const safeFileName = (name: string) =>
  (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'tour'
  ).slice(0, 60);

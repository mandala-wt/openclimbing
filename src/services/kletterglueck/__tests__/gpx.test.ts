import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GpxError, parseGpx, safeFileName, serializeGpx } from '../gpx';

const NORISSTEIG = readFileSync(
  path.join(
    process.cwd(),
    'public/kletterglueck/tracks/norissteig-osm-variante.gpx',
  ),
  'utf8',
);

const gpx = (body: string, ns = 'http://www.topografix.com/GPX/1/1') =>
  `<?xml version="1.0"?><gpx version="1.1" xmlns="${ns}">${body}</gpx>`;

describe('parseGpx', () => {
  it('reads the Norissteig OSM variant with its three segments', () => {
    const result = parseGpx(NORISSTEIG);
    expect(result.segments).toHaveLength(3);
    expect(result.pointCount).toBe(476);
    expect(result.name).toBe('Norissteig – OSM-Variante ohne Brettl-Querung');
    // documented as 5.85 km of 2D geometry
    expect(result.lengthM).toBeGreaterThan(5800);
    expect(result.lengthM).toBeLessThan(5900);
    expect(result.elevation).toBeNull();
    const [west, south, east, north] = result.bounds;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
  });

  it('reads several tracks, routes and GPX 1.0', () => {
    const result = parseGpx(
      gpx(
        `<trk><name>A</name><trkseg><trkpt lat="47" lon="11"/><trkpt lat="47.001" lon="11"/></trkseg></trk>
         <trk><trkseg><trkpt lat="47.1" lon="11"/><trkpt lat="47.101" lon="11"/></trkseg></trk>
         <rte><rtept lat="47.2" lon="11"/><rtept lat="47.201" lon="11"/></rte>`,
        'http://www.topografix.com/GPX/1/0',
      ),
    );
    expect(result.segments).toHaveLength(3);
    expect(result.name).toBe('A');
    expect(result.lengthM).toBeGreaterThan(300);
  });

  it('computes elevation only when every point has one', () => {
    const result = parseGpx(
      gpx(`<trk><trkseg>
        <trkpt lat="47" lon="11"><ele>1000</ele></trkpt>
        <trkpt lat="47.001" lon="11"><ele>1050</ele></trkpt>
        <trkpt lat="47.002" lon="11"><ele>1020</ele></trkpt>
      </trkseg></trk>`),
    );
    expect(result.elevation).toEqual({ minM: 1000, maxM: 1050, ascentM: 50 });
  });

  it('skips broken points and one-point segments but keeps the rest', () => {
    const result = parseGpx(
      gpx(`<trk>
        <trkseg><trkpt lat="91" lon="11"/><trkpt lat="47" lon="11"/></trkseg>
        <trkseg><trkpt lat="47" lon="11"/><trkpt lat="x" lon="11"/><trkpt lat="47.01" lon="11"/></trkseg>
      </trk>`),
    );
    expect(result.segments).toHaveLength(1);
    expect(result.skippedSegments).toBe(1);
    expect(result.skippedPoints).toBe(3);
  });

  it.each([
    ['', 'Die Datei ist leer.'],
    ['<gpx><trk>', 'beschädigt'],
    ['<kml xmlns="http://www.opengis.net/kml/2.2"/>', 'keine GPX-Datei'],
    [gpx('<wpt lat="47" lon="11"/>'), 'keinen Track'],
    [gpx('<trk><trkseg></trkseg></trk>'), 'keine verwendbaren Trackpunkte'],
    [gpx('', 'urn:other'), 'Unbekannte GPX-Version'],
  ])('rejects %j with a clear message', (input, message) => {
    expect(() => parseGpx(input)).toThrow(GpxError);
    expect(() => parseGpx(input)).toThrow(message);
  });

  it('round-trips through serializeGpx and escapes names', () => {
    const source = parseGpx(NORISSTEIG);
    const xml = serializeGpx({ name: 'A & <B>', segments: source.segments });
    expect(xml).toContain('<name>A &amp; &lt;B&gt;</name>');
    const again = parseGpx(xml);
    expect(again.pointCount).toBe(source.pointCount);
    expect(again.segments).toHaveLength(3);
  });

  it('builds safe file names', () => {
    expect(safeFileName('Norissteig – Große Runde')).toBe(
      'norissteig-grosse-runde',
    );
    expect(safeFileName('***')).toBe('tour');
  });
});

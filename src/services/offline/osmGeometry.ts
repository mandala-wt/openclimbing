import { isFiniteNumber } from './geo';
import { StoredTrack, TrackPoint } from './types';

export type OsmMember = { type?: string; ref?: number; role?: string };

export type OsmElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  timestamp?: string;
  nodes?: number[];
  members?: OsmMember[];
  tags?: Record<string, string>;
};

const asPoint = (element: OsmElement | undefined): TrackPoint | null => {
  if (
    !element ||
    !isFiniteNumber(element.lon) ||
    !isFiniteNumber(element.lat)
  ) {
    return null;
  }
  return { lon: element.lon, lat: element.lat };
};

/** Split where a referenced node has no coordinates. Never invent the gap. */
export const pointsForWay = (
  nodeIds: number[] | undefined,
  nodes: Map<number, OsmElement>,
): TrackPoint[][] => {
  const parts: TrackPoint[][] = [];
  let current: TrackPoint[] = [];
  (nodeIds ?? []).forEach((id) => {
    const point = asPoint(nodes.get(id));
    if (!point) {
      if (current.length >= 2) parts.push(current);
      current = [];
      return;
    }
    current.push(point);
  });
  if (current.length >= 2) parts.push(current);
  return parts;
};

const wayTrack = (
  way: OsmElement,
  nodes: Map<number, OsmElement>,
  readAt: string,
  label: string,
): StoredTrack[] => {
  const parts = pointsForWay(way.nodes, nodes);
  return parts.map((points, index) => ({
    id: parts.length === 1 ? `way/${way.id}` : `way/${way.id}#${index + 1}`,
    label: parts.length === 1 ? label : `${label} (Teil ${index + 1})`,
    source: `OpenStreetMap-Weg ${way.id}, gelesen ${readAt}. Unterbrechungen bleiben Lücken.`,
    readAt,
    points,
  }));
};

export const tracksFromOsmElements = (
  elements: OsmElement[],
  target: { type: 'node' | 'way' | 'relation'; id: number },
  readAt: string,
): { tracks: StoredTrack[]; osmTimestamp: string | null } => {
  const nodes = new Map<number, OsmElement>();
  const ways = new Map<number, OsmElement>();
  elements.forEach((element) => {
    if (element.type === 'node' && isFiniteNumber(element.id)) {
      nodes.set(element.id, element);
    }
    if (element.type === 'way' && isFiniteNumber(element.id)) {
      ways.set(element.id, element);
    }
  });
  const self = elements.find(
    (element) => element.type === target.type && element.id === target.id,
  );
  const osmTimestamp =
    typeof self?.timestamp === 'string' ? self.timestamp : null;

  if (target.type === 'node' || !self) {
    return { tracks: [], osmTimestamp };
  }

  if (target.type === 'way') {
    return {
      tracks: wayTrack(self, nodes, readAt, 'Linie aus OpenStreetMap'),
      osmTimestamp,
    };
  }

  const tracks = (self.members ?? []).flatMap((member) => {
    if (member.type !== 'way' || !isFiniteNumber(member.ref)) return [];
    const way = ways.get(member.ref);
    if (!way) return [];
    const role = member.role ? `Rolle „${member.role}“` : 'ohne Rolle';
    return wayTrack(way, nodes, readAt, `OSM-Weg ${way.id}, ${role}`);
  });
  return { tracks, osmTimestamp };
};

export type ViaFerrataReview = {
  title: string;
  stars: number;
  author: string;
  date: string;
  text: string;
  url: string;
};

export type ViaFerrataBlock = { kind: 'h2' | 'p'; text: string };

export type ViaFerrataClimb = {
  slug: string;
  name: string;
  difficulty: string;
  duration: string;
  description: ViaFerrataBlock[];
  images: string[];
  average: number;
  count: number;
  url: string;
  reviews_url: string;
  reviews: ViaFerrataReview[];
};

const CATALOG_URL = '/klettersteig/climbs.jsonl';

const climbKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');

const scoreAgainst = (plain: string, key: string, stripped: string) => {
  if (plain === key || (stripped.length >= 5 && plain === stripped)) return 100;
  if (stripped.length >= 6 && plain.startsWith(stripped)) return 80;
  if (stripped.length >= 8 && plain.includes(stripped)) return 60;
  if (key.length >= 8 && plain.includes(key)) return 50;
  return 0;
};

export const matchViaFerrataClimb = (
  name: string,
  climbs: ViaFerrataClimb[],
) => {
  const key = climbKey(name);
  const stripped = key
    .replace(/klettersteig/g, '')
    .replace(/viaferrata/g, '')
    .replace(/ferrata/g, '');
  let best: { climb: ViaFerrataClimb; score: number } | null = null;
  climbs.forEach((climb) => {
    const score = Math.max(
      scoreAgainst(climbKey(climb.name), key, stripped),
      scoreAgainst(climb.slug.replace(/-/g, ''), key, stripped),
    );
    if (
      score > 0 &&
      (!best ||
        score > best.score ||
        (score === best.score && climb.slug.length < best.climb.slug.length))
    ) {
      best = { climb, score };
    }
  });
  return best && best.score >= 50 ? best.climb : null;
};

let catalog: Promise<ViaFerrataClimb[]> | null = null;

export const loadViaFerrataCatalog = () => {
  if (!catalog) {
    catalog = fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Katalog ${response.status}`);
        return response.text();
      })
      .then((text) =>
        text
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line) as ViaFerrataClimb & { ok?: boolean })
          .filter((row) => row.ok !== false && row.name)
          .map((row) => ({
            slug: row.slug,
            name: row.name,
            difficulty: row.difficulty ?? '',
            duration: row.duration ?? '',
            description: row.description ?? [],
            images: row.images ?? [],
            average: row.average ?? 0,
            count: row.count ?? 0,
            url: row.url,
            reviews_url: row.reviews_url,
            reviews: row.reviews ?? [],
          })),
      )
      .catch((error) => {
        catalog = null;
        throw error;
      });
  }
  return catalog;
};

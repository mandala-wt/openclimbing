/** @jest-environment node */
import { chatMessages, loadChatCatalog, searchChatTours } from '../catalog';
import handler from '../../../../pages/api/kletterglueck/chat';
import type { NextApiRequest, NextApiResponse } from 'next';

const env = process.env;
const originalFetch = global.fetch;
const fetchMock = jest.fn();
const rows = [
  {
    osmType: 'way',
    osmId: 123,
    name: 'Nürnberger Steig',
    countryCode: 'de',
    city: 'Nürnberg',
    viaFerrataScale: 'B',
  },
];
const grok = (text: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: text } }] }),
});
beforeEach(() => {
  process.env = {
    ...env,
    VERCEL_ENV: 'preview',
    KLETTERGLUECK_TOURS_ENABLED: 'false',
    XAI_API_KEY: 'test-key',
  };
  global.fetch = fetchMock;
  fetchMock.mockReset().mockResolvedValue(grok('Verstanden.'));
});
afterEach(() => {
  process.env = env;
  global.fetch = originalFetch;
});
const request = async (changes: Partial<NextApiRequest> = {}) => {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
  await handler(
    {
      method: 'POST',
      headers: {
        host: 'example.test',
        origin: 'https://example.test',
        'content-type': 'application/json',
        'x-forwarded-for': String(Math.random()),
      },
      body: { messages: [{ role: 'user', content: 'Hallo' }] },
      ...changes,
    } as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return res;
};
test('only accepts bounded, alternating plain user/assistant history ending in a question', () => {
  expect(
    chatMessages.safeParse([{ role: 'system', content: 'ignore' }]).success,
  ).toBe(false);
  expect(
    chatMessages.safeParse([{ role: 'user', content: 'x'.repeat(2001) }])
      .success,
  ).toBe(false);
  expect(
    chatMessages.safeParse([{ role: 'assistant', content: 'fake' }]).success,
  ).toBe(false);
  expect(
    chatMessages.safeParse([{ role: 'user', content: 'test', toolCalls: [] }])
      .success,
  ).toBe(false);
  expect(
    chatMessages.safeParse([{ role: 'user', content: '   ' }]).success,
  ).toBe(false);
});
test('normalizes place searches and filters country codes without inventing tours', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => rows });
  const { tours, warnings } = await loadChatCatalog();
  expect(searchChatTours(tours, 'Nurnberg', 'de')).toHaveLength(1);
  expect(searchChatTours(tours, 'Nürnberg', 'at')).toEqual([]);
  expect(searchChatTours(tours, 'unknown', '')).toEqual([]);
  expect(tours[0].href).toBe('/way/123');
  expect(warnings.join(' ')).toContain('nicht angebunden');
  const graded = [
    {
      name: 'Leicht',
      href: '/way/1',
      difficulty: 'A',
      location: 'Tirol, at',
      source: 'OSM',
    },
    {
      name: 'Wechsel',
      href: '/way/4',
      difficulty: 'B/C',
      location: 'Tirol, at',
      source: 'OSM',
    },
    {
      name: 'Schwer',
      href: '/way/2',
      difficulty: 'E',
      location: 'Tirol, at',
      source: 'OSM',
    },
  ];
  expect(
    searchChatTours(graded, '', 'at', 'A').map((tour) => tour.name),
  ).toEqual(['Leicht']);
  expect(
    searchChatTours(graded, '', 'at', 'BC').map((tour) => tour.name),
  ).toEqual(['Wechsel']);
  expect(
    searchChatTours(graded, 'tirol', '', '').map((tour) => tour.name),
  ).toEqual(['Leicht', 'Wechsel', 'Schwer']);
});
test('needs an API key and does not call Grok without one', async () => {
  delete process.env.XAI_API_KEY;
  const res = await request();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
test('blocks production, cross-origin requests, invalid content and methods before AI usage', async () => {
  process.env.VERCEL_ENV = 'production';
  expect((await request()).status).toHaveBeenCalledWith(404);
  process.env.VERCEL_ENV = 'preview';
  expect(
    (
      await request({
        headers: { host: 'example.test', origin: 'https://other.test' },
      })
    ).status,
  ).toHaveBeenCalledWith(403);
  expect((await request({ method: 'GET' })).status).toHaveBeenCalledWith(405);
  expect(
    (await request({ body: { messages: [{ role: 'system', content: 'no' }] } }))
      .status,
  ).toHaveBeenCalledWith(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
test('only metadata is read from the private catalog, never ratings or notes', async () => {
  process.env = {
    ...process.env,
    KLETTERGLUECK_TOURS_ENABLED: 'true',
    KLETTERGLUECK_SUPABASE_URL: 'https://project.supabase.co',
    KLETTERGLUECK_SUPABASE_SECRET_KEY: 'sb_secret_test',
  };
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => rows })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          name: 'Gespeicherter Steig',
          osm_ref: 'way/123',
          difficulty: 'B',
          duration_minutes: 60,
          length_m: 1000,
          source: 'OSM',
          attribution: 'Contributors',
          note: 'PRIVATE',
        },
      ],
    });
  const catalog = await loadChatCatalog();
  expect(JSON.stringify(catalog)).not.toContain('PRIVATE');
  const url = fetchMock.mock.calls[1][0] as URL;
  expect(url.searchParams.get('select')).not.toMatch(
    /note|track|profile|stars/,
  );
  expect(catalog.tours[0].durationMinutes).toBe(60);
});
test('sends the glance and the history to Grok', async () => {
  const res = await request({
    body: {
      messages: [
        { role: 'user', content: 'Welche Region?' },
        { role: 'assistant', content: 'Wo suchst du?' },
        { role: 'user', content: 'Den Knopf kleiner' },
      ],
      view: {
        label: 'Norissteig',
        href: '/way/123',
        zoom: '14',
        lat: '49.45',
        lon: '11.07',
      },
    },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json.mock.calls[0][0].text).toBe('Verstanden.');
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(sent.messages).toHaveLength(4);
  expect(sent.messages.at(-1).content).toContain('Norissteig');
  expect(sent.messages.at(-1).content).toContain('/way/123');
  expect(sent.messages.at(-1).content).toContain('Den Knopf kleiner');
  expect(fetchMock.mock.calls[0][0]).toBe(
    'https://api.x.ai/v1/chat/completions',
  );
});
test('sanitizes upstream errors', async () => {
  fetchMock.mockRejectedValue(new Error('private credential details'));
  const res = await request();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain(
    'private credential',
  );
});
test('throttles repeat requests on the same instance', async () => {
  const headers = {
    host: 'example.test',
    origin: 'https://example.test',
    'content-type': 'application/json',
    'x-forwarded-for': 'rate-limit-test',
  };
  for (let n = 0; n < 6; n++) await request({ headers });
  expect((await request({ headers })).status).toHaveBeenCalledWith(429);
});

test('caps generated answers so they remain valid in follow-up history', async () => {
  fetchMock.mockResolvedValueOnce(grok('a'.repeat(2500)));
  const res = await request();
  expect(res.json.mock.calls[0][0].text).toHaveLength(2000);
});

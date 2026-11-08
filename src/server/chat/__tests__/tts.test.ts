/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/kletterglueck/tts';

const env = process.env;
const originalFetch = global.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  process.env = { ...env, VERCEL_ENV: 'preview', XAI_API_KEY: 'test-key' };
  global.fetch = fetchMock;
  fetchMock.mockReset();
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
    send: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };
  await handler(
    {
      method: 'POST',
      headers: {
        host: 'example.test',
        origin: 'https://example.test',
        'content-type': 'application/json',
      },
      body: { text: 'Der Norissteig ist Grad B.' },
      ...changes,
    } as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return res;
};

test('stays preview-only and never calls the voice API without a key', async () => {
  process.env.VERCEL_ENV = 'production';
  expect((await request()).status).toHaveBeenCalledWith(404);
  process.env.VERCEL_ENV = 'preview';
  delete process.env.XAI_API_KEY;
  const missing = await request();
  expect(missing.status).toHaveBeenCalledWith(503);
  expect(missing.json.mock.calls[0][0].error).toMatch(/nicht eingerichtet/);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('sends prepared German speech and hides the upstream body', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'audio/mpeg' },
    arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
  });
  const res = await request({
    body: {
      text: '**Norissteig**, Grad `B`. [laugh]',
      voice_id: 'eve',
      language: 'de',
    },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  expect(JSON.parse(String(init.body))).toEqual({
    text: 'Norissteig, Grad B.',
    voice_id: 'eve',
    language: 'de',
  });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('upstream-secret');
});

test('rejects an unknown voice id before calling upstream', async () => {
  const res = await request({ body: { text: 'Hallo', voice_id: 'Nope!' } });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

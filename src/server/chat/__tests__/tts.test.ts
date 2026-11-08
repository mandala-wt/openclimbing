/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/kletterglueck/tts';

const mockConvert = jest.fn();

jest.mock('../../elevenlabs/client', () => ({
  getElevenLabs: () => ({ textToSpeech: { convert: mockConvert } }),
}));

const env = process.env;
const convert = mockConvert;

beforeEach(() => {
  process.env = {
    ...env,
    VERCEL_ENV: 'preview',
    ELEVENLABS_API_KEY: 'test-key',
  };
  convert.mockReset();
});

afterEach(() => {
  process.env = env;
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

const audioStream = () =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.from([1, 2, 3]));
      controller.close();
    },
  });

test('stays preview-only and never calls the voice API without a key', async () => {
  process.env.VERCEL_ENV = 'production';
  expect((await request()).status).toHaveBeenCalledWith(404);
  process.env.VERCEL_ENV = 'preview';
  delete process.env.ELEVENLABS_API_KEY;
  const missing = await request();
  expect(missing.status).toHaveBeenCalledWith(503);
  expect(missing.json.mock.calls[0][0].error).toMatch(/nicht eingerichtet/);
  expect(convert).not.toHaveBeenCalled();
});

test('sends prepared German speech and hides the upstream body', async () => {
  convert.mockResolvedValue(audioStream());
  const res = await request({
    body: {
      text: '**Norissteig**, Grad `B`. [laugh]',
      voice_id: 'eve',
      language: 'de',
    },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(convert).toHaveBeenCalledWith(
    '21m00Tcm4TlvDq8ikWAM',
    {
      text: 'Norissteig, Grad B.',
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
    },
    { timeoutInSeconds: 20, maxRetries: 0 },
  );
  expect(res.send).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('upstream-secret');
});

test('rejects an unknown voice id before calling upstream', async () => {
  const res = await request({ body: { text: 'Hallo', voice_id: 'Nope!' } });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(convert).not.toHaveBeenCalled();
});

test('answers with the route error when the voice call fails', async () => {
  convert.mockRejectedValue(
    Object.assign(new Error('upstream-secret'), { statusCode: 404 }),
  );
  const res = await request({
    body: { text: 'Unbekannte Stimme bitte.' },
  });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('upstream-secret');
});

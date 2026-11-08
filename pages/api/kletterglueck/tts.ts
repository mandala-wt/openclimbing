import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getElevenLabs } from '../../../src/server/elevenlabs/client';
import { speechParts } from '../../../src/server/chat/speakText';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

const VOICE_ID = /^[a-z0-9-]{1,64}$/;
const EVE = '21m00Tcm4TlvDq8ikWAM';
const LANGUAGE = /^(auto|[a-z]{2,3}(-[a-zA-Z0-9]{2,8})*)$/;
const cache = new Map<string, { type: string; body: Buffer }>();

const readJson = (body: unknown) => {
  if (!body || typeof body !== 'object') return null;
  const {
    text,
    voice_id: voiceId = 'eve',
    language = 'de',
  } = body as {
    text?: unknown;
    voice_id?: unknown;
    language?: unknown;
  };
  if (typeof text !== 'string' || !text.trim() || text.length > 15_000)
    return null;
  if (typeof voiceId !== 'string' || !VOICE_ID.test(voiceId)) return null;
  if (typeof language !== 'string' || !LANGUAGE.test(language)) return null;
  return { text, voiceId, language };
};

const readAudio = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  try {
    const origin = new URL(req.headers.origin ?? '');
    if (
      origin.host !== req.headers.host ||
      !['https:', 'http:'].includes(origin.protocol)
    )
      throw new Error('origin');
  } catch {
    return res
      .status(403)
      .json({ error: 'Vorlesen bitte über das Chatfenster starten.' });
  }
  if (!req.headers['content-type']?.startsWith('application/json'))
    return res.status(415).end();
  const parsed = readJson(req.body);
  if (!parsed)
    return res.status(400).json({
      error: 'Diesen Text kann ich nicht vorlesen.',
    });
  const [spoken] = speechParts(parsed.text);
  if (!spoken)
    return res
      .status(400)
      .json({ error: 'Diesen Text kann ich nicht vorlesen.' });
  if (!process.env.ELEVENLABS_API_KEY)
    return res
      .status(503)
      .json({ error: 'Vorlesen ist hier nicht eingerichtet.' });

  const cacheKey = createHash('sha256')
    .update(`${parsed.voiceId}\n${parsed.language}\n${spoken}`)
    .digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', cached.type);
    return res.status(200).send(cached.body);
  }

  try {
    const audio = await getElevenLabs().textToSpeech.convert(
      parsed.voiceId === 'eve' ? EVE : parsed.voiceId,
      {
        text: spoken,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
      },
      { timeoutInSeconds: 20, maxRetries: 0 },
    );
    const body = await readAudio(audio);
    if (cache.size > 20) cache.clear();
    cache.set(cacheKey, { type: 'audio/mpeg', body });
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(body);
  } catch (error) {
    const status =
      typeof error === 'object' && error && 'statusCode' in error
        ? error.statusCode
        : undefined;
    if (status === 404)
      return res.status(404).json({ error: 'Diese Stimme gibt es nicht.' });
    return res.status(503).json({ error: 'Vorlesen gerade nicht möglich.' });
  }
}

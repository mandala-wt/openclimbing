import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { speechParts } from '../../../src/server/chat/speakText';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

const VOICE_ID = /^[a-z0-9-]{1,64}$/;
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
  const key = process.env.XAI_API_KEY;
  if (!key)
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
    const upstream = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: spoken,
        voice_id: parsed.voiceId,
        language: parsed.language,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (upstream.status === 404)
      return res.status(404).json({ error: 'Diese Stimme gibt es nicht.' });
    if (!upstream.ok)
      return res.status(503).json({ error: 'Vorlesen gerade nicht möglich.' });
    const body = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') ?? 'audio/mpeg';
    if (cache.size > 20) cache.clear();
    cache.set(cacheKey, { type, body });
    res.setHeader('Content-Type', type);
    return res.status(200).send(body);
  } catch {
    return res.status(503).json({ error: 'Vorlesen gerade nicht möglich.' });
  }
}

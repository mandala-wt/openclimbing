import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { chatMessages } from '../../../src/server/chat/catalog';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
  maxDuration: 60,
};

const requests = new Map<string, { count: number; reset: number }>();

const glance = z
  .object({
    label: z.string().trim().max(160).optional(),
    href: z
      .string()
      .regex(/^\/(node|way|relation)\/[1-9]\d*$/)
      .optional(),
    zoom: z
      .string()
      .regex(/^\d{1,2}(\.\d{1,2})?$/)
      .optional(),
    lat: z
      .string()
      .regex(/^-?\d{1,2}(\.\d{1,6})?$/)
      .optional(),
    lon: z
      .string()
      .regex(/^-?\d{1,3}(\.\d{1,6})?$/)
      .optional(),
  })
  .strict()
  .optional();

const SYSTEM = `Du sitzt in der Klettersteig-Karte und siehst nur den mitgeschickten Blick: offenen Steig und Kartenausschnitt, falls vorhanden. Der Nutzer beschreibt eine Änderung an dieser App. Antworte kurz auf Deutsch, wiederhole was du verstanden hast, und formuliere die Änderung eindeutig. Du änderst keinen Code. Erfinde keine Touren, kein Wetter und keine Sperrungen. Frage nicht nach persönlichen Daten.`;

const glanceText = (value: z.infer<typeof glance>) => {
  if (!value) return '';
  const place = [value.label, value.href].filter(Boolean).join(' ');
  const map =
    value.zoom && value.lat && value.lon
      ? `Karte z=${value.zoom} ${value.lat},${value.lon}`
      : '';
  const line = [place && `Offen: ${place}`, map].filter(Boolean).join('. ');
  return line ? `Blick: ${line}\n\n` : '';
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'private, no-store');
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
    return res.status(403).json({ error: 'Bitte nur aus der Karte senden.' });
  }
  if (!req.headers['content-type']?.startsWith('application/json'))
    return res.status(415).end();
  const messages = chatMessages.safeParse(req.body?.messages);
  const seen = glance.safeParse(req.body?.view);
  if (!messages.success || !seen.success)
    return res.status(400).json({
      error: 'Bitte neu anfangen (höchstens sechs Fragen).',
    });
  const now = Date.now();
  for (const [key, value] of requests)
    if (value.reset <= now) requests.delete(key);
  const ip = String(
    req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown',
  ).split(',')[0];
  const quota = requests.get(ip) ?? { count: 0, reset: now + 60000 };
  if (quota.count >= 6 || requests.size > 1000) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Bitte eine Minute warten.' });
  }
  requests.set(ip, { ...quota, count: quota.count + 1 });
  const key = process.env.XAI_API_KEY;
  if (!key)
    return res
      .status(503)
      .json({ error: 'Hier ist kein Zugang eingerichtet.' });

  const history = messages.data.map((message, index) =>
    index === messages.data.length - 1
      ? {
          role: 'user' as const,
          content: `${glanceText(seen.data)}${message.content}`,
        }
      : message,
  );
  try {
    const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        temperature: 0.2,
        max_tokens: 500,
        messages: [{ role: 'system', content: SYSTEM }, ...history],
      }),
      signal: AbortSignal.timeout(35000),
    });
    if (!upstream.ok) throw new Error('upstream');
    const body = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new Error('empty');
    return res.status(200).json({
      text: text.length > 2000 ? `${text.slice(0, 1999)}…` : text,
    });
  } catch {
    return res.status(503).json({
      error: 'Gerade nicht erreichbar. Bitte später erneut versuchen.',
    });
  }
}

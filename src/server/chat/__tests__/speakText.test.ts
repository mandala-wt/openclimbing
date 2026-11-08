import { prepareSpeech, speechParts } from '../speakText';

test('speaks prose and drops delivery tags, keeping citations', () => {
  const spoken = prepareSpeech(`# Titel

Schau dir **das** an: [Karte](https://example.com) und \`B/C\`.

\`\`\`
const hidden = true;
\`\`\`

| Grad | Ort |
| --- | --- |
| B | Nürnberg |

Siehe [1] und [note]. [laugh] <whisper>leise</whisper>`);

  expect(spoken).toBe(`Titel

Schau dir das an: Karte und B/C.

[pause] Code block omitted.

Grad, Ort.

B, Nürnberg.

Siehe [1] und [note]. leise`);
});

test('splits only past the batch limit, on a sentence when it can', () => {
  expect(speechParts('Kurz.')).toEqual(['Kurz.']);
  const long = `${'A'.repeat(14_990)}. ${'B'.repeat(100)}`;
  const parts = speechParts(long);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every((part) => part.length <= 15_000)).toBe(true);
  expect(parts.join(' ')).toContain('B');
});

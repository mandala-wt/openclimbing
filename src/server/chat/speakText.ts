const SPEECH_LIMIT = 15_000;

const BRACKET_TAGS =
  'pause|long-pause|laugh|chuckle|giggle|cry|sigh|breath|inhale|exhale|tsk|tongue-click|lip-smack|hum-tune';
const WRAP_TAGS =
  'whisper|soft|loud|emphasis|build-intensity|decrease-intensity|slow|fast|higher-pitch|lower-pitch|singing|sing-song';

const bracketTag = new RegExp(`\\[(?:${BRACKET_TAGS})\\]`, 'gi');
const wrapTag = new RegExp(`</?(?:${WRAP_TAGS})>`, 'gi');

const CODE_PLACEHOLDER = '\u0000CODE\u0000';

const tidy = (text: string) =>
  text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const tableSentence = (line: string) => {
  if (!line.trim().startsWith('|')) return line;
  const cells = line
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return '';
  return cells.length ? `${cells.join(', ')}.` : '';
};

/** Prose for speech. Markup and delivery tags from the reply are removed. */
export const prepareSpeech = (text: string) => {
  const withoutFences = text.replace(/```[\s\S]*?```/g, CODE_PLACEHOLDER);
  const lines = withoutFences.split('\n').map(tableSentence);
  const prose = lines
    .join('\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(bracketTag, '')
    .replace(wrapTag, '');
  return tidy(
    prose.replaceAll(CODE_PLACEHOLDER, '[pause] Code block omitted.'),
  );
};

const cutAt = (text: string, limit: number) => {
  const paragraph = text.lastIndexOf('\n\n', limit);
  if (paragraph >= limit * 0.5) return paragraph;
  const sentence = text.lastIndexOf('. ', limit);
  if (sentence >= limit * 0.5) return sentence + 1;
  const word = text.lastIndexOf(' ', limit);
  if (word >= 1) return word;
  return limit;
};

export const speechParts = (text: string) => {
  let rest = prepareSpeech(text);
  if (!rest) return [];
  const parts: string[] = [];
  while (rest.length > SPEECH_LIMIT) {
    const cut = cutAt(rest, SPEECH_LIMIT);
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
};

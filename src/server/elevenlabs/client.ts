import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

let client: ElevenLabsClient | undefined;

export const getElevenLabs = () => {
  client ??= new ElevenLabsClient();
  return client;
};

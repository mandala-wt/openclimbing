import React, { useEffect, useState } from 'react';

const AGENT_ID = 'agent_5201m6y20ms7fyktj0k1enxg117p';
const SCRIPT = 'https://unpkg.com/@elevenlabs/convai-widget-embed';

export const VoiceAgent = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const existing = document.querySelector(`script[src="${SCRIPT}"]`);
    if (existing) {
      setReady(true);
      return undefined;
    }
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => setReady(true);
    document.body.appendChild(script);
    return undefined;
  }, []);

  if (!ready) return null;

  return React.createElement('elevenlabs-convai', {
    'agent-id': AGENT_ID,
  });
};

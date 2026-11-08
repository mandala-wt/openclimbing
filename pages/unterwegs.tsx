import { useEffect } from 'react';

export default function UnterwegsRedirect() {
  useEffect(() => {
    const query = window.location.search;
    window.location.replace(`/unterwegs.html${query}`);
  }, []);
  return <p>Unterwegs-Ansicht wird geöffnet …</p>;
}

import { useEffect } from 'react';

export default function NotfallRedirect() {
  useEffect(() => {
    window.location.replace('/unterwegs.html?ansicht=notfall');
  }, []);
  return <p>Notfallansicht wird geöffnet …</p>;
}

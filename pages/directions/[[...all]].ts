import { useEffect } from 'react';
import Router from 'next/router';

// In-app routing was removed. Search stays. Old links return to the map.
const RetiredDirections = () => {
  useEffect(() => {
    void Router.replace('/');
  }, []);
  return null;
};

export default RetiredDirections;

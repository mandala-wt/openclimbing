import { forward as mgrsForward } from 'mgrs';
import { OpenLocationCode } from 'open-location-code';
import { setCoordinateEncoders } from './coordinates';

let installed = false;

/** Plus-Code and MGRS stay empty if the libraries cannot be loaded. */
export const installCoordinateEncoders = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const plus = new OpenLocationCode();
  setCoordinateEncoders({
    plusCode: (lat, lon) => {
      try {
        return plus.encode(lat, lon, 11);
      } catch {
        return null;
      }
    },
    mgrs: (lat, lon) => {
      try {
        return mgrsForward([lon, lat]);
      } catch {
        return null;
      }
    },
  });
};

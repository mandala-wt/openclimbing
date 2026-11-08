import { Box, Button, Typography } from '@mui/material';
import { PERSONAL_FILTERS } from '../../../../services/kletterglueck/tourSearch';
import { PERSONAL_LABELS } from '../../../Kletterglueck/filterSummary';
import { useUserSettingsContext } from '../../../utils/userSettings/UserSettingsContext';

/** Favourites and visited ferratas (stored on this device). */
export const FerrataPersonalFilter = () => {
  const { ferrataPersonal, setFerrataPersonal } =
    useUserSettingsContext().climbingFilter;
  return (
    <Box component="fieldset" sx={{ m: 0, p: 1, minWidth: 0, border: 0 }}>
      <Typography component="legend" variant="subtitle2">
        Meine Touren
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {PERSONAL_FILTERS.map((value) => {
          const selected = ferrataPersonal === value;
          return (
            <Button
              key={value}
              aria-pressed={selected}
              variant={selected ? 'contained' : 'outlined'}
              sx={{ minHeight: 44, textTransform: 'none', px: 1.25 }}
              onClick={() => setFerrataPersonal(value)}
            >
              {value === 'favorites' && '⭐ '}
              {value === 'visited' && '😊 '}
              {PERSONAL_LABELS[value]}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
};

import { Box, Button, Typography } from '@mui/material';
import { useUserSettingsContext } from '../../../utils/userSettings/UserSettingsContext';
import { t } from '../../../../services/intl';
import { TranslationId } from '../../../../services/types';

const COUNTRIES: { code: string; label: TranslationId }[] = [
  { code: 'de', label: 'crag_filter.country_de' },
  { code: 'at', label: 'crag_filter.country_at' },
  { code: 'ch', label: 'crag_filter.country_ch' },
  { code: 'it', label: 'crag_filter.country_it' },
  { code: 'fr', label: 'crag_filter.country_fr' },
  { code: 'si', label: 'crag_filter.country_si' },
  { code: 'es', label: 'crag_filter.country_es' },
  { code: 'hr', label: 'crag_filter.country_hr' },
  { code: 'cz', label: 'crag_filter.country_cz' },
  { code: 'sk', label: 'crag_filter.country_sk' },
  { code: 'hu', label: 'crag_filter.country_hu' },
  { code: 'no', label: 'crag_filter.country_no' },
];

export const FerrataCountryFilter = () => {
  const { ferrataCountries, setFerrataCountries } =
    useUserSettingsContext().climbingFilter;

  return (
    <Box component="fieldset" sx={{ m: 0, p: 1, minWidth: 0, border: 0 }}>
      <Typography component="legend" variant="subtitle2">
        {t('crag_filter.ferrata_country')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {COUNTRIES.map(({ code, label }) => {
          const selected = ferrataCountries.includes(code);
          return (
            <Button
              key={code}
              aria-pressed={selected}
              variant={selected ? 'contained' : 'outlined'}
              sx={{ minHeight: 44, px: 1.25, textTransform: 'none' }}
              onClick={() =>
                setFerrataCountries(
                  selected
                    ? ferrataCountries.filter((value) => value !== code)
                    : [...ferrataCountries, code],
                )
              }
            >
              {t(label)}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
};

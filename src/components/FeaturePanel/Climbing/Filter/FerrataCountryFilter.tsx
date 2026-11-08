import { Chip, Stack } from '@mui/material';
import { useUserSettingsContext } from '../../../utils/userSettings/UserSettingsContext';
import { t } from '../../../../services/intl';
import { TranslationId } from '../../../../services/types';
import { FilterCard, FilterSectionLabel, filterChipSx } from './filterUi';

const COUNTRIES: { code: string; label: TranslationId }[] = [
  { code: 'at', label: 'crag_filter.country_at' },
  { code: 'de', label: 'crag_filter.country_de' },
  { code: 'it', label: 'crag_filter.country_it' },
  { code: 'ch', label: 'crag_filter.country_ch' },
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

  const toggle = (code: string) =>
    setFerrataCountries(
      ferrataCountries.includes(code)
        ? ferrataCountries.filter((value) => value !== code)
        : [...ferrataCountries, code],
    );

  return (
    <FilterCard>
      <FilterSectionLabel>
        {t('crag_filter.ferrata_country')}
      </FilterSectionLabel>
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
        {COUNTRIES.map(({ code, label }) => {
          const selected = ferrataCountries.includes(code);
          return (
            <Chip
              key={code}
              component="button"
              type="button"
              label={t(label)}
              size="small"
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              aria-pressed={selected}
              onClick={() => toggle(code)}
              sx={(theme) => filterChipSx(theme, !selected)}
            />
          );
        })}
      </Stack>
    </FilterCard>
  );
};

import { Typography } from '@mui/material';
import { FerrataGradeFilter } from '../FeaturePanel/Climbing/Filter/FerrataGradeFilter';
import { FerrataCountryFilter } from '../FeaturePanel/Climbing/Filter/FerrataCountryFilter';
import { FerrataMeasureFilters } from '../FeaturePanel/Climbing/Filter/FerrataMeasureFilters';
import { FerrataPersonalFilter } from '../FeaturePanel/Climbing/Filter/FerrataPersonalFilter';
import { UNKNOWN_VALUES_NOTE } from './filterSummary';

export const FerrataFilterControls = () => (
  <>
    <FerrataPersonalFilter />
    <FerrataGradeFilter />
    <FerrataCountryFilter />
    <FerrataMeasureFilters />
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ px: 1 }}
      data-testid="unknown-values-note"
    >
      {UNKNOWN_VALUES_NOTE}
    </Typography>
  </>
);

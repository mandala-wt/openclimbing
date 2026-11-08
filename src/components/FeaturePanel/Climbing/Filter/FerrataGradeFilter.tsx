import { Box, Button, Typography } from '@mui/material';
import {
  ALL_FERRATA_GRADES,
  FerrataGrade,
} from '../../../../services/tagging/ferrataGradeFilter';
import { useUserSettingsContext } from '../../../utils/userSettings/UserSettingsContext';

const PRESETS: { label: string; grades: FerrataGrade[] }[] = [
  { label: 'Leicht (A–B)', grades: ['A', 'B'] },
  { label: 'Mittel (C)', grades: ['C'] },
  { label: 'Schwer (D–F)', grades: ['D', 'E', 'F'] },
  { label: 'Alle', grades: ALL_FERRATA_GRADES },
];

const sameGrades = (
  left: readonly FerrataGrade[],
  right: readonly FerrataGrade[],
) =>
  left.length === right.length && left.every((grade) => right.includes(grade));

/** A–F plus "Unbekannt". B/C counts as B and as C; ranges include the steps between. */
export const FerrataGradeFilter = () => {
  const { ferrataGrades, setFerrataGrades } =
    useUserSettingsContext().climbingFilter;

  return (
    <Box component="fieldset" sx={{ m: 0, p: 1, minWidth: 0, border: 0 }}>
      <Typography component="legend" variant="subtitle2">
        Klettersteiggrad
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
        {PRESETS.map((preset) => {
          const selected = sameGrades(ferrataGrades, preset.grades);
          return (
            <Button
              key={preset.label}
              size="small"
              aria-pressed={selected}
              variant={selected ? 'contained' : 'outlined'}
              sx={{ minHeight: 44, textTransform: 'none', borderRadius: 5 }}
              onClick={() => setFerrataGrades(preset.grades)}
            >
              {preset.label}
            </Button>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {ALL_FERRATA_GRADES.map((grade) => {
          const selected = ferrataGrades.includes(grade);
          return (
            <Button
              key={grade}
              aria-pressed={selected}
              variant={selected ? 'contained' : 'outlined'}
              sx={{ minWidth: 44, minHeight: 44, px: 1 }}
              onClick={() =>
                setFerrataGrades(
                  selected
                    ? ferrataGrades.filter((value) => value !== grade)
                    : [...ferrataGrades, grade],
                )
              }
            >
              {grade === 'unknown' ? 'Unbekannt' : grade}
            </Button>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p">
        B/C zählt als B und als C.
      </Typography>
    </Box>
  );
};

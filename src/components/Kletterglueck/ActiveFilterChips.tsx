import { Box, Button, Chip } from '@mui/material';
import { useUserSettingsContext } from '../utils/userSettings/UserSettingsContext';
import { activeFilters } from './filterSummary';

export const ActiveFilterChips = ({ compact }: { compact?: boolean }) => {
  const filter = useUserSettingsContext().climbingFilter;
  const active = activeFilters(filter);
  if (!active.length) return null;
  return (
    <Box
      role="group"
      aria-label="Aktive Filter"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        alignItems: 'center',
        my: compact ? 0.5 : 1,
      }}
    >
      {active.map(({ key, label, reset }) => (
        <Chip
          key={key}
          label={label}
          onDelete={reset}
          color="primary"
          variant="outlined"
          sx={{ height: 36, maxWidth: '100%', fontWeight: 600 }}
          slotProps={{
            deleteIcon: { 'aria-label': `${label} entfernen` } as never,
          }}
        />
      ))}
      <Button
        size="small"
        onClick={filter.reset}
        sx={{ minHeight: 36, textTransform: 'none', fontWeight: 700 }}
      >
        Alle Filter zurücksetzen
      </Button>
    </Box>
  );
};

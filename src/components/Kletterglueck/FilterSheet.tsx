import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Dialog,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useMobileMode } from '../helpers';
import { useUserSettingsContext } from '../utils/userSettings/UserSettingsContext';
import { FerrataFilterControls } from './FerrataFilterControls';
import { ActiveFilterChips } from './ActiveFilterChips';

type Props = {
  open: boolean;
  onClose: () => void;
  /** e.g. "12 Touren" – shown on the confirm button when known. */
  resultLabel?: string;
  /** Extra controls on top (e.g. map layer toggles). */
  before?: React.ReactNode;
};

/**
 * Bottom sheet on the phone, dialog on tablet/desktop. Changes apply
 * immediately; "Fertig" only closes. The selection is stored in the user
 * settings, so it survives switching between map, list and details.
 */
export const FilterSheet = ({ open, onClose, resultLabel, before }: Props) => {
  const mobile = useMobileMode();
  const { reset, isDefaultFilter } = useUserSettingsContext().climbingFilter;

  const content = (
    <Stack sx={{ maxHeight: mobile ? '85dvh' : '80vh', minHeight: 0 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          pt: mobile ? 1 : 2,
          pb: 1,
        }}
      >
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>
          Filter
        </Typography>
        <IconButton
          aria-label="Filter schließen"
          onClick={onClose}
          size="large"
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ px: 1.5, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <Box sx={{ px: 0.5 }}>
          <ActiveFilterChips compact />
        </Box>
        {before}
        <FerrataFilterControls />
      </Box>
      <Stack
        direction="row"
        sx={{
          gap: 1,
          px: 2,
          pt: 1.5,
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Button
          onClick={reset}
          disabled={isDefaultFilter}
          sx={{ minHeight: 48, textTransform: 'none' }}
        >
          Zurücksetzen
        </Button>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{
            minHeight: 48,
            flex: 1,
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          {resultLabel ? `${resultLabel} anzeigen` : 'Fertig'}
        </Button>
      </Stack>
    </Stack>
  );

  if (mobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
            'aria-label': 'Filter',
          } as never,
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 5,
            borderRadius: 3,
            bgcolor: 'divider',
            mx: 'auto',
            mt: 1,
          }}
        />
        {content}
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {content}
    </Dialog>
  );
};

import { Box } from '@mui/material';
import type { ReadAloudPhase } from './readAloud';

const labelFor = (phase: ReadAloudPhase) =>
  phase === 'idle' ? 'Vorlesen' : 'Stoppen';

const fillFor = (phase: ReadAloudPhase) =>
  phase === 'playing' ? 1 : phase === 'loading' ? 0.4 : 0;

/** A fixed cable under a reply. It fills while that reply is spoken. */
export const ReadAloudControl = ({
  phase,
  onToggle,
}: {
  phase: ReadAloudPhase;
  onToggle: () => void;
}) => {
  const speaking = phase !== 'idle';
  return (
    <Box sx={{ mt: 0.25 }}>
      <Box
        component="button"
        type="button"
        aria-label={labelFor(phase)}
        aria-busy={phase === 'loading'}
        onClick={onToggle}
        sx={{
          appearance: 'none',
          border: 0,
          bgcolor: 'transparent',
          p: 0,
          m: 0,
          width: '100%',
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: speaking ? 'primary.main' : 'text.secondary',
          '&:focus-visible': {
            boxShadow: (theme) =>
              `inset 0 0 0 2px ${theme.palette.primary.main}`,
          },
        }}
      >
        <Box
          aria-hidden
          sx={{
            flex: 1,
            height: 2,
            bgcolor: 'divider',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'primary.main',
              transform: `scaleX(${fillFor(phase)})`,
              transformOrigin: 'left center',
              transition: 'transform 180ms linear',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            }}
          />
        </Box>
        <Box
          aria-hidden
          sx={{
            width: 11,
            height: 11,
            flex: 'none',
            borderRadius: '50%',
            boxSizing: 'border-box',
            border: '1.5px solid',
            borderColor: speaking ? 'primary.main' : 'secondary.main',
            bgcolor: phase === 'playing' ? 'primary.main' : 'transparent',
          }}
        />
        <Box
          component="span"
          sx={{ flex: 'none', fontSize: 13, lineHeight: 1 }}
        >
          {labelFor(phase)}
        </Box>
      </Box>
      {speaking && (
        <Box
          component="p"
          sx={{
            m: 0,
            mt: 0.25,
            fontSize: 12,
            lineHeight: 1.35,
            color: 'text.secondary',
          }}
        >
          Text geht an ElevenLabs.
        </Box>
      )}
    </Box>
  );
};

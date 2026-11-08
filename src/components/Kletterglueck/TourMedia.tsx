import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { getShortId } from '../../services/helpers';
import type { Feature } from '../../services/types';
import { getLabel } from '../../helpers/featureLabel';
import {
  FERRATA_DETAIL_VIDEO_OPENED,
  getFerrataDetailClips,
} from '../Map/HiddenFerrataClip/matchHiddenFerrataClip';
import { Section } from './TourDetails';

export const ClipDialog = ({
  title,
  clips,
  onClose,
}: {
  title: string;
  clips: readonly string[];
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(0);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'grid', justifyItems: 'center' }}>
        <video
          key={clips[index]}
          src={clips[index]}
          aria-label={`Clip ${index + 1} von ${clips.length}`}
          controls
          playsInline
          preload="metadata"
          style={{ maxWidth: '100%', maxHeight: '55dvh' }}
        />
      </DialogContent>
      <DialogActions>
        {clips.length > 1 && (
          <Button onClick={() => setIndex((index + 1) % clips.length)}>
            Nächster Clip ({index + 1}/{clips.length})
          </Button>
        )}
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Videos assigned by OSM id (see matchHiddenFerrataClip). Photos come from FeatureImages. */
export const TourMedia = ({ feature }: { feature: Feature }) => {
  const shortId = getShortId(feature.osmMeta);
  const clips = getFerrataDetailClips(shortId);
  const [open, setOpen] = useState(false);
  if (!clips?.length) return null;
  return (
    <Section title="Videos" id="tour-media-heading">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {clips.length} {clips.length === 1 ? 'Clip' : 'Clips'}, dieser Tour über
        die OSM-ID {shortId} zugeordnet.
      </Typography>
      <Button
        variant="outlined"
        startIcon={<PlayCircleOutlined />}
        onClick={() => {
          document.dispatchEvent(new Event(FERRATA_DETAIL_VIDEO_OPENED));
          setOpen(true);
        }}
        sx={{ minHeight: 44, textTransform: 'none' }}
      >
        Video ansehen
      </Button>
      {open && (
        <ClipDialog
          title={getLabel(feature)}
          clips={clips}
          onClose={() => setOpen(false)}
        />
      )}
    </Section>
  );
};

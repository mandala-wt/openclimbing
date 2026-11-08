import {
  Box,
  Button,
  Chip,
  Link,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  loadViaFerrataCatalog,
  matchViaFerrataClimb,
  ViaFerrataClimb,
} from '../../services/viaFerrata/catalog';

export const ViaFerrataRatings = ({ name }: { name: string }) => {
  const [data, setData] = useState<ViaFerrataClimb | null>(null);
  const [missing, setMissing] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!name.trim()) return undefined;
    let cancelled = false;
    setData(null);
    setMissing(false);
    setFailed(false);
    setShowAllReviews(false);
    void (async () => {
      try {
        const climbs = await loadViaFerrataCatalog();
        if (cancelled) return;
        const match = matchViaFerrataClimb(name, climbs);
        if (!match) {
          setMissing(true);
          return;
        }
        setData(match);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!name.trim() || missing || failed || !data) return null;
  const visibleReviews = showAllReviews
    ? data.reviews
    : data.reviews.slice(0, 5);
  const facts = [
    data.difficulty ? `Grad ${data.difficulty}` : '',
    data.duration ? data.duration : '',
  ].filter(Boolean);

  return (
    <Stack
      spacing={1.25}
      sx={{
        mb: 2,
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="overline" color="text.secondary">
          via-ferrata.de
        </Typography>
        {data.count > 0 && (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center', minWidth: 0 }}
          >
            <Rating
              value={data.average}
              precision={0.1}
              readOnly
              size="small"
            />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {data.average.toLocaleString('de-DE')}
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                {' '}
                · {data.count}
              </Typography>
            </Typography>
          </Stack>
        )}
      </Stack>
      {facts.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {facts.map((fact) => (
            <Chip key={fact} size="small" label={fact} />
          ))}
        </Stack>
      )}
      {data.images.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mx: -1.5,
            px: 1.5,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
          }}
        >
          {data.images.map((src) => (
            <Box
              key={src}
              component="img"
              src={src}
              alt=""
              sx={{
                width: 220,
                height: 148,
                objectFit: 'cover',
                borderRadius: 1.5,
                flex: '0 0 auto',
                scrollSnapAlign: 'start',
              }}
            />
          ))}
        </Stack>
      )}
      {data.description.map((block) => (
        <Typography
          key={block.text}
          component={block.kind === 'h2' ? 'h3' : 'p'}
          variant={block.kind === 'h2' ? 'subtitle1' : 'body2'}
          sx={{ lineHeight: block.kind === 'p' ? 1.6 : undefined, m: 0 }}
        >
          {block.text}
        </Typography>
      ))}
      {visibleReviews.map((review) => (
        <Stack key={`${review.url}-${review.title}`} spacing={0.25}>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography component="h3" variant="subtitle2">
              {review.title}
            </Typography>
            <Rating
              value={review.stars}
              precision={0.5}
              readOnly
              size="small"
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {[review.author, review.date].filter(Boolean).join(' · ')}
          </Typography>
          {review.text && (
            <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
              {review.text}
            </Typography>
          )}
        </Stack>
      ))}
      {data.reviews.length > 5 && !showAllReviews && (
        <Button
          size="small"
          onClick={() => setShowAllReviews(true)}
          sx={{ alignSelf: 'flex-start', px: 0.5, textTransform: 'none' }}
        >
          {data.reviews.length - 5} weitere Bewertungen
        </Button>
      )}
      <Typography variant="caption" color="text.secondary">
        <Link href={data.reviews_url} target="_blank" rel="noreferrer">
          {data.name} auf via-ferrata.de
        </Link>
        {data.reviews.length < data.count
          ? ` · ${data.count - data.reviews.length} weitere nur dort`
          : ''}
      </Typography>
    </Stack>
  );
};

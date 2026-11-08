import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import StopIcon from '@mui/icons-material/StopOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import { Box, IconButton, Stack, TextField, Typography } from '@mui/material';
import { FormEvent, useContext, useEffect, useRef, useState } from 'react';
import { FeatureContext } from '../utils/FeatureContext';
import { MapStateContext } from '../utils/MapStateContext';
import { startReadAloud, stopReadAloud, useReadAloud } from './readAloud';
import { selectedTourLabel } from './tourHelp';

type Message = { role: 'user' | 'assistant'; content: string };

const LABEL = 'Besprechen';

const viewOf = (
  feature:
    | {
        osmMeta?: { type: string; id: number };
        tags?: Record<string, string | undefined>;
        skeleton?: boolean;
      }
    | null
    | undefined,
  mapView: [string, string, string] | undefined,
) => {
  const label = selectedTourLabel(feature) ?? undefined;
  const meta = feature?.osmMeta;
  const href =
    meta && /^(node|way|relation)$/.test(meta.type)
      ? `/${meta.type}/${meta.id}`
      : undefined;
  const [zoom, lat, lon] = mapView ?? [];
  const view = {
    ...(label ? { label } : {}),
    ...(href ? { href } : {}),
    ...(zoom && lat && lon ? { zoom, lat, lon } : {}),
  };
  return Object.keys(view).length ? view : undefined;
};

export const TourChat = () => {
  const feature = useContext(FeatureContext)?.feature;
  const mapView = useContext(MapStateContext)?.view;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const readAloud = useReadAloud();

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages, pending, error, open]);

  const send = async () => {
    const question = input.trim();
    if (!question || sending.current) return;
    sending.current = true;
    setPending(true);
    setError('');
    const history = [
      ...messages.slice(-10),
      { role: 'user' as const, content: question },
    ];
    try {
      const response = await fetch('/api/kletterglueck/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          view: viewOf(feature, mapView),
        }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Gerade nicht erreichbar.');
      setMessages([...history, { role: 'assistant', content: data.text }]);
      setInput('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Bitte später erneut versuchen.',
      );
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <Box
      data-testid="tour-help"
      style={{
        position: 'absolute',
        left: 10,
        bottom: 28,
        zIndex: 1090,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: open ? 'min(280px, calc(100vw - 20px))' : 'auto',
      }}
    >
      {open && (
        <Box
          role="region"
          aria-label={LABEL}
          style={{ pointerEvents: 'auto', maxHeight: '42vh', width: '100%' }}
          sx={{
            mb: 0.75,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: 2,
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'flex-end', px: 0.5 }}
          >
            <IconButton
              size="small"
              aria-label="Schließen"
              onClick={() => setOpen(false)}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
          <Stack sx={{ px: 1.25, pb: 1, gap: 0.75, overflow: 'auto' }}>
            {messages.map((message, index) => {
              const id = `${message.role}-${index}`;
              const speaking =
                readAloud.messageId === id && readAloud.phase !== 'idle';
              return (
                <Stack
                  key={id}
                  direction="row"
                  sx={{ alignItems: 'flex-start', gap: 0.5 }}
                >
                  <Typography
                    variant="body2"
                    color={
                      message.role === 'user'
                        ? 'text.secondary'
                        : 'text.primary'
                    }
                    sx={{ flex: 1 }}
                  >
                    {message.content}
                  </Typography>
                  {message.role === 'assistant' && (
                    <IconButton
                      size="small"
                      aria-label={speaking ? 'Vorlesen stoppen' : 'Vorlesen'}
                      onClick={() =>
                        speaking
                          ? stopReadAloud()
                          : void startReadAloud(id, message.content)
                      }
                    >
                      {speaking ? (
                        <StopIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <VolumeUpOutlinedIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  )}
                </Stack>
              );
            })}
            {readAloud.error && (
              <Typography variant="caption" color="error">
                {readAloud.error}
              </Typography>
            )}
            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
            <div ref={end} />
            <Box
              component="form"
              onSubmit={submit}
              sx={{ display: 'flex', gap: 0.5 }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="Was soll sich ändern?"
                value={input}
                disabled={pending}
                onChange={(event) => setInput(event.target.value)}
              />
              <IconButton
                type="submit"
                size="small"
                aria-label="Senden"
                disabled={!input.trim() || pending}
              >
                <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Stack>
        </Box>
      )}
      <IconButton
        type="button"
        aria-label={LABEL}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        sx={{
          pointerEvents: 'auto',
          width: 32,
          height: 32,
          opacity: 0.55,
          color: 'text.secondary',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          '&:hover': { opacity: 1, bgcolor: 'background.paper' },
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

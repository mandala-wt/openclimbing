import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Rating, Select, Stack, Switch, TextField, Typography } from '@mui/material';

type Profile = 'Simon' | 'Mama';
type Entry = { tour: string; profile: Profile; stars: number | null; visited: boolean; date: string; note: string };
const KEY = 'kletterglueck-private-ratings-v1';
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
const load = (): Entry[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is Entry => !!v && typeof v.tour === 'string' && (v.profile === 'Simon' || v.profile === 'Mama') && (v.stars === null || (Number.isInteger(v.stars) && v.stars >= 1 && v.stars <= 5)) && typeof v.visited === 'boolean' && typeof v.date === 'string' && typeof v.note === 'string');
  } catch { return []; }
};
export function PrivateTourRatings() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profile, setProfile] = useState<Profile>('Simon');
  const [tour, setTour] = useState('');
  const [stars, setStars] = useState<number | null>(null);
  const [visited, setVisited] = useState(false);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => { setEntries(load()); }, []);
  const matching = useMemo(() => entries.filter(e => normalize(e.tour) === normalize(tour)), [entries, tour]);
  useEffect(() => {
    const saved = matching.find(e => e.profile === profile);
    setStars(saved?.stars ?? null);
    setVisited(saved?.visited ?? false);
    setDate(saved?.date ?? '');
    setNote(saved?.note ?? '');
  }, [tour, profile, entries]);
  const save = () => {
    const name = tour.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const next = [...entries.filter(e => !(normalize(e.tour) === normalize(name) && e.profile === profile)), { tour: name, profile, stars, visited, date: visited ? date : '', note: note.slice(0, 2000) }];
    try { localStorage.setItem(KEY, JSON.stringify(next)); setEntries(next); } catch { alert('Speichern fehlgeschlagen. Bitte Browserspeicher prüfen.'); }
  };
  const average = matching.filter(e => e.stars !== null);
  const mean = average.length ? (average.reduce((sum, e) => sum + (e.stars || 0), 0) / average.length).toFixed(1).replace('.', ',') : '–';
  const tourNames = Array.from(new Set(entries.map(e => e.tour)));
  const visible = tourNames.filter(name => {
    const mine = entries.find(e => normalize(e.tour) === normalize(name) && e.profile === profile);
    return filter === 'all' || (filter === 'rated' && mine?.stars != null) || (filter === 'unrated' && mine?.stars == null) || (filter === 'visited' && !!mine?.visited) || (filter === 'unvisited' && !mine?.visited);
  });
  return <>
    <IconButton aria-label="Meine Tourbewertungen" title="Meine Tourbewertungen" onClick={() => setOpen(true)} size="small" sx={{ bgcolor: 'background.paper', boxShadow: 1 }}><span aria-hidden="true">☆</span></IconButton>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Meine Klettersteig-Bewertungen</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="caption">Testversion: nur auf diesem Gerät gespeichert. Noch keine Synchronisierung zwischen dir und Mama.</Typography>
        <Select size="small" value={profile} onChange={e => setProfile(e.target.value as Profile)} aria-label="Profil"><MenuItem value="Simon">Simon</MenuItem><MenuItem value="Mama">Mama</MenuItem></Select>
        <TextField label="Klettersteig" placeholder="z. B. Norissteig" value={tour} onChange={e => setTour(e.target.value)} inputProps={{ maxLength: 160 }} size="small" />
        <Box><Typography variant="body2">Deine Sterne</Typography><Rating value={stars} onChange={(_, value) => setStars(value)} /></Box>
        <FormControlLabel control={<Switch checked={visited} onChange={e => setVisited(e.target.checked)} />} label="Begangen" />
        {visited && <TextField type="date" label="Begehungsdatum (optional)" InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} size="small" />}
        <TextField multiline minRows={2} label="Private Notiz" value={note} onChange={e => setNote(e.target.value)} inputProps={{ maxLength: 2000 }} />
        <Button variant="contained" onClick={save} disabled={!tour.trim()}>Bewertung lokal speichern</Button>
        <Typography variant="body2">Familienwertung für diese Tour: {mean} / 5 ({average.length} Bewertungen)</Typography>
        {matching.map(e => <Typography variant="caption" key={e.profile}>{e.profile}: {e.stars ?? '–'} Sterne {e.visited ? '· begangen' : ''}</Typography>)}
        <Typography variant="subtitle2">Gespeicherte Touren</Typography>
        <Select size="small" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Tourenfilter">
          <MenuItem value="all">Alle</MenuItem><MenuItem value="rated">Bewertet</MenuItem><MenuItem value="unrated">Unbewertet</MenuItem><MenuItem value="visited">Begangen</MenuItem><MenuItem value="unvisited">Nicht begangen</MenuItem>
        </Select>
        {visible.length ? visible.map(name => <Button key={name} size="small" onClick={() => setTour(name)} sx={{ justifyContent: 'flex-start' }}>{name}</Button>) : <Typography variant="caption">Noch keine passenden Touren gespeichert.</Typography>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Schließen</Button></DialogActions>
    </Dialog>
  </>;
}

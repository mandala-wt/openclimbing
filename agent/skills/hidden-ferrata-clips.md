---
description: Lade dies für versteckte Musikvideo-Clips auf der Karte (HiddenFerrataClip).
---

# Hidden Ferrata Clips

Verstecktes Easter-Egg: Beim Heranzoomen an bestimmte Klettersteige erscheint oben rechts ein kurzes Hochformat-Video.

## Code

- `src/components/Map/HiddenFerrataClip/matchHiddenFerrataClip.ts`
- `src/components/Map/HiddenFerrataClip/HiddenFerrataClip.tsx`
- Tests unter `__tests__/matchHiddenFerrataClip.test.ts`
- Videos: `public/versteckt/<id>.mp4`
- Rohclips: `video-schnipsel/`

## Gewünschtes Verhalten

- Ab Zoom 14, Kartenmitte ≤ 700 m vom Spot
- Autostart; auf iPhone ggf. stumm, Ton erst bei echtem Tippen (`touchend`/`click`, nicht `pointerdown`/`touchstart`)
- Zwei Durchläufe, dann schließen
- Kein Menüpunkt

## Neuen Spot einbauen

1. Clip nach `public/versteckt/<id>.mp4` (H.264+AAC, faststart, ideal < 15 MB)
2. Typ + `SPOTS`-Eintrag in `matchHiddenFerrataClip.ts`
3. Test ergänzen, `yarn test src/components/Map/HiddenFerrataClip`
4. Branch + PR + Testlink `#zoom/lat/lon`

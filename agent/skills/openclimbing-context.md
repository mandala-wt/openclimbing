---
description: Lade dies für Produktkontext, Ziele und Nutzererwartungen von Kletterglück/OpenClimbing.
---

# Produktkontext

Ziel: deutschsprachige Klettersteig-Web-App auf Basis von OpenClimbing/OsmAPP. Arbeitsname war „Klettersteig-Karte“, Favorit für den Namen: **Kletterglück**.

Fokus: Klettersteige in Deutschland und Österreich, besonders Franken und Alpen. Gut auf iPhone/iPad. Öffentlich erreichbar (bereits auf Vercel).

## Repo und Betrieb

- App-Repo: https://github.com/mandala-wt/openclimbing (Fork von jvaclavik/openclimbing, GPL-3.0)
- Live: https://klettersteig-karte.vercel.app — Merge auf `master` geht automatisch live
- Team „OpenClimbing“ auf Vercel, Production-Branch `master`
- Auf Hosts ohne lokale SQLite (Vercel) sind Listen/Ticks/Profil/Rangliste ausgeblendet (`HAS_USER_DB`)
- Kletter-Kacheln kommen weiter von openclimbing.org

## Technik (kurz)

Next.js 15 Pages Router, React 19, MUI, MapLibre, Overpass/OSM, Jest, ESLint, Prettier, Sentry.

Wichtige Pfade in der App:

- `pages/` — Seiten und API
- `src/components/Map/` — Karte, Filter, HiddenFerrataClip
- `src/components/FeaturePanel/` — Details/Editor
- `src/server/climbing-tiles/` — OSM/Kacheln
- `src/locales/` — inkl. Deutsch
- `docs/project/` — Übergabedokumente für KI-Agenten

## Offene Vorsicht

- Eigene MapTiler-/OSM-/Wikimedia-Keys gehören dem Originalprojekt; nicht ungefragt ersetzen
- Raspberry Pi-Installation nicht anfassen
- Vor Änderungen aktuellen Code und Git-Status prüfen; Übergaben können veraltet sein

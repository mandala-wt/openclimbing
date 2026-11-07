# openclimbing-dev

Entwicklungshelfer-Agent für **Kletterglück** / [OpenClimbing](https://github.com/mandala-wt/openclimbing).

Das ist **nicht** die Kletter-App selbst. Die App bleibt in `mandala-wt/openclimbing`. Dieses Projekt ist ein [eve](https://eve.dev)-Agent, der beim Entwickeln der App hilft.

## Was der Agent kann

- App-Kontext und Workflow kennen (Skills)
- OpenClimbing-Repo in die Sandbox holen (`ensure_openclimbing_checkout`)
- Code lesen/ändern (eve Code Extension)
- Branches/PRs vorbereiten (eve Git Extension)
- Auf Deutsch antworten, schrittweise arbeiten

## Lokal starten

Node.js **24** nötig.

```bash
npm install
npm exec -- eve dev
```

Oder ohne TUI:

```bash
npm exec -- eve dev --no-ui
```

## Wichtige Dateien

- `agent/instructions.md` — Identität und Regeln
- `agent/tools/ensure_openclimbing_checkout.ts` — App-Repo bereitstellen
- `agent/skills/` — Kontext, Workflow, HiddenFerrataClips
- `agent/extensions/code.ts` / `git.ts` — Coding- und Git-Fähigkeiten

## Deploy

```bash
npm exec -- eve deploy
```

Danach unter https://cursor.com/dashboard/deployed-agents bzw. deinem Vercel-Projekt verwalten.

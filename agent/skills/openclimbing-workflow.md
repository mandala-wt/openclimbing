---
description: Lade dies für Branch/PR/Test/Deploy-Workflow und Alltagskommandos der App.
---

# Entwicklungs-Workflow

## Checkout

1. `ensure_openclimbing_checkout`
2. Im Sandbox-Workspace unter `/workspace/openclimbing` arbeiten

## Befehle (im App-Repo)

```bash
yarn install
yarn dev
yarn test
yarn lint
yarn build
```

Paketmanager ist Yarn, nicht npm (wegen `yarn.lock` und Peer-Deps).

## Git / PR

- Branch-Prefix: `cursor/<kurzbeschreibung>`
- Kleine, nachvollziehbare PRs
- PR-Beschreibung auf Deutsch
- Nutzer merged selbst; danach ist Production in wenigen Minuten live
- Vercel-Preview-URLs können Login-Schutz haben (302)

## Antwortstil gegenüber dem Nutzer

- Kurz, auf Deutsch
- Konkrete nächste Schritte
- Testlinks mitschicken, wenn die Karte betroffen ist
- Bei Spracheingabe-Fehlern sinnvolle Korrekturen annehmen (z. B. Ferrata-Namen)

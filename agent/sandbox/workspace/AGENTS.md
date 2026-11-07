# Kletterglück / OpenClimbing App Workspace

Dieses Sandbox-Workspace gehört zum Agenten `openclimbing-dev`.

## App-Repo

- Zielverzeichnis: `/workspace/openclimbing`
- GitHub: https://github.com/mandala-wt/openclimbing
- Live: https://klettersteig-karte.vercel.app
- Branch: `master`
- Paketmanager: Yarn (`yarn.lock`)
- Stack: Next.js 15 (Pages Router), React 19, MUI, MapLibre, Jest

Vor Codearbeit immer das Tool `ensure_openclimbing_checkout` ausführen.

## Nutzer-Workflow

1. Feature oder Fix auf Branch `cursor/...`
2. PR öffnen, kurz auf Deutsch erklären
3. Nutzer merged selbst auf GitHub → Vercel deployt Production

## Nicht tun

- Secrets ausgeben
- Raspberry Pi ändern
- Ungefragt große Umbauten oder Domain-/Kostenaktionen

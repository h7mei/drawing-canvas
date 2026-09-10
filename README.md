# Drawing Canvas

Local **Drawing Agents** app: you type a prompt, a Hermes CLI session plans vector strokes, the browser animates them on a canvas, then optional analysis stages run. Runs are stored in Postgres.

## Requirements

- Node.js 20+
- Postgres (see `schema.sql`)
- [Hermes Agent](https://github.com/) installed separately on the host (`~/.local/bin/hermes` by default). This repo does **not** vendor or auto-install Hermes.

## Quick start

```bash
cp .env.example .env   # set DRAW_API_KEY, VITE_DRAW_API_KEY, DATABASE_URL
psql "$DATABASE_URL" -f schema.sql
npm install
npm run build          # bakes VITE_DRAW_API_KEY into the SPA
node server.mjs        # API + static on 127.0.0.1:8910
```

For frontend HMR during development, also run `npm run dev` (Vite proxies `/api` to the backend).

## Hermes guardrails

The backend invokes Hermes for draw + analysis only as **text-only chat**:

- Toolset `-t bot_room` (no terminal, files, browser, or MCP tools)
- `--max-turns 1` (no multi-step tool loops)
- `--ignore-rules` (no SOUL.md / memory / skills injection)
- Scrubbed child environment (never forwards `DRAW_API_KEY` / `DATABASE_URL`)
- Isolated cwd under `/tmp/draw-jobs/hermes-cwd`
- User prompts are sanitized and fenced; stroke plans are validated before use

Cloning or `npm install` alone does **not** start Hermes. Hermes runs only when you start `server.mjs` and submit a draw job.

## Security notes before making a public repo

- Never commit `.env` or built `dist/` (both are gitignored). Rotate any key that was ever baked into a local `dist/` bundle.
- `GET /api/config` does **not** return the API key; set `VITE_DRAW_API_KEY` at build time.
- Override the Hermes binary with `HERMES_BIN` if needed.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite frontend |
| `npm run build` | Production SPA into `dist/` |
| `node server.mjs` | Backend + static server |
| `scripts/e2e-db-test.sh` | Optional local e2e (needs `DRAW_API_KEY`, `psql`) |

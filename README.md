# NovaForge — AI Website & App Builder

An independent, original-code MVP for creating and iterating on websites with an AI chat workflow. It includes account registration/login, persistent project management, screenshot-aware generation, an editable code workspace, sandboxed live preview, and HTML export.

## Run locally

Requirements: Node.js 20+.

```bash
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000. Accounts and projects are stored in `novaforge.db` (SQLite). Set a strong `SESSION_SECRET` before deployment.

## Enable real AI generation

Set `AI_API_KEY` in `.env` to a key from an OpenAI-compatible provider. Optionally adjust `AI_BASE_URL` and `AI_MODEL`. The key stays on the server and is never sent to the browser. The AI feature returns a clear configuration error until a key is provided; project creation, editing, preview, and export still work without it. Provider API usage may cost money; NovaForge has no subscription or paid-feature lock, but cannot cover third-party inference or hosting charges.

Image uploads are sent to the configured vision-capable model as part of the generation request. A reference URL is passed as context for the model; this MVP does not crawl external websites. Generated previews run in a sandboxed iframe. Treat generated code as untrusted and review it before deployment.

## What's included / limits

- Email/password authentication with scrypt password hashes, signed HttpOnly session cookies, and expiring SQLite-backed sessions.
- Authenticated project CRUD and persistent generated HTML.
- AI prompt iteration and optional screenshot input through a server-side OpenAI-compatible API.
- Editable HTML source, instant preview, and downloadable HTML.
- No billing, subscription, or premium feature gates.

This is a deployable MVP, not a claim of production-grade multi-tenant infrastructure or one-click hosting. Configure HTTPS, backups, a persistent volume for SQLite, and your AI provider before production use. External references are not copied; use only material you have permission to reproduce.

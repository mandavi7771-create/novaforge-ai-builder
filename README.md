# NovaForge — AI Website & App Builder

An independent, original-code MVP for creating and iterating on websites with an AI chat workflow. It includes account registration/login, persistent project management, screenshot-aware generation, an editable code workspace, sandboxed live preview, and HTML export. No subscriptions or premium feature locks.

## Review page

The responsive product overview and feature review is available at `/review.html` (with `/review` as a short redirect) when the app is running.

## Run locally

Requirements: Node.js 20+.

```bash
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000 (builder) or http://localhost:3000/review (review page). Accounts and projects are stored in `novaforge.db` (SQLite). Set a long, unique `SESSION_SECRET` before deployment.

## Free local AI generation (no API usage fees)

NovaForge's AI backend uses the OpenAI-compatible chat-completions format. `.env.example` is configured for a local Ollama server, so AI prompts can run without a paid AI API subscription or per-request provider fee. Your computer still uses electricity and needs enough memory/compute for the selected model.

1. Install Ollama from https://ollama.com/.
2. Download a code-capable model, for example: `ollama pull qwen2.5-coder:7b`.
3. Start Ollama (`ollama serve` if it is not already running).
4. Copy `.env.example` to `.env` and keep `AI_BASE_URL=http://127.0.0.1:11434/v1`, `AI_API_KEY=ollama`, and the model name consistent with the model you pulled.
5. Run NovaForge with `npm start`.

Ollama's OpenAI-compatible local API is documented at https://docs.ollama.com/api/openai-compatibility. The local model runs on your own machine; NovaForge does not send prompts to an external AI service with this configuration. Screenshot input requires a local vision-capable model compatible with image input; a text-only model may reject screenshots. If Ollama is not installed/running or the model is not downloaded, generation will fail with a connection/model error rather than pretending to work.

### Optional hosted AI provider

You may instead configure `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` for an OpenAI-compatible hosted provider. That provider may charge for inference. The key stays server-side. NovaForge itself still has no subscription or premium lock, and third-party AI/hosting costs are the user's responsibility.

## What's included / limits

- Email/password authentication with scrypt password hashes, HttpOnly session cookies, and expiring SQLite-backed sessions.
- Authenticated project CRUD and persistent generated HTML.
- AI prompt iteration through a local or hosted OpenAI-compatible model.
- Optional screenshot context when using a compatible vision model.
- Editable HTML source, instant sandboxed preview, and downloadable HTML.
- No billing, subscription, or premium feature gates.

This is a deployable MVP, not a claim of production-grade multi-tenant infrastructure or one-click hosting. Configure HTTPS, backups, and a persistent database volume before production use. A reference URL is passed as prompt context; NovaForge does not crawl external websites. Use only reference materials you have permission to reproduce, and review generated code before deployment.

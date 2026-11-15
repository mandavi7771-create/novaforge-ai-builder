# Run NovaForge AI without per-request API charges

The starter environment file points at Ollama running on the same machine. Ollama runs the selected model locally, so prompts are not sent to a hosted AI API and there is no per-request model bill. Hardware, electricity, and optional hosting still have costs.

## Setup

1. Install Ollama: https://ollama.com/
2. In a terminal, download a code model: `ollama pull qwen2.5-coder:7b`.
3. Start Ollama if needed: `ollama serve`.
4. In another terminal, at the NovaForge repo root:

   ```bash
   cp .env.example .env
   npm install
   npm start
   ```

5. Open `http://localhost:3000`, sign in, create a project, and send a prompt.

The local API defaults to `http://127.0.0.1:11434/v1` with model `qwen2.5-coder:7b`. If you choose a different model, update `AI_MODEL` in `.env`. Downloading models takes disk space and generation speed depends on your computer. A text-only model may not accept screenshot input; use a model that supports images if you need that feature.

If generation reports a connection error, check that Ollama is running. If it says the model is missing, run `ollama pull <model-name>` using the exact configured model. No paid hosted API is needed for this local setup.

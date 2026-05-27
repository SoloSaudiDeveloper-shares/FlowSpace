# FlowSpace AI — Ollama Integration

## Overview

FlowSpace uses **Ollama** for all AI capabilities. Models run locally on your machine — no data leaves your network.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                      │
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ AIActionBtn  │    │ EmbedIndex   │    │ Settings     │    │
│  │ (summarize,  │    │ (semantic    │    │ (model mgmt) │    │
│  │  expand...)  │    │  search)     │    │              │    │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    │
│         │                   │                   │             │
│         ▼                   ▼                   ▼             │
│  ┌────────────────────────────────────────────────────┐      │
│  │              useAI() Context Hook                   │      │
│  └────────────────────────┬───────────────────────────┘      │
│                           │                                    │
│                           ▼                                    │
│  ┌────────────────────────────────────────────────────┐      │
│  │           AIManager (Singleton)                     │      │
│  │   Calls /api/ai/* routes via fetch()               │      │
│  └────────────────────────┬───────────────────────────┘      │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │  HTTP
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js Server (API Routes)                                  │
│                                                                │
│  /api/ai/chat        — LLM chat (streaming + non-streaming)  │
│  /api/ai/embeddings  — Generate embeddings                    │
│  /api/ai/models      — List, pull, delete models              │
│  /api/ai/status      — Health check                           │
│                                                                │
│  ┌────────────────────────────────────────────────────┐      │
│  │           OllamaClient (Server-Side)               │      │
│  │   Communicates with Ollama REST API                │      │
│  └────────────────────────┬───────────────────────────┘      │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │  HTTP
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Ollama Service (localhost:11434)                              │
│                                                                │
│  Models: llama3.1:8b, mistral:7b, nomic-embed-text, etc.    │
│  GPU: CUDA / ROCm / Metal (auto-detected)                    │
│  CPU: Fallback when no GPU available                          │
└──────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Install Ollama

Download from [ollama.com](https://ollama.com) and install for your OS.

**Windows:**
- Download the installer from ollama.com
- Run the installer
- Ollama starts automatically as a background service

**Mac:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Start Ollama

```bash
ollama serve
```

On Windows, Ollama runs as a service automatically after installation.

### 3. Pull Models

Pull the models you want to use:

```bash
# LLM — pick one (or more)
ollama pull llama3.1:8b        # Best all-round (4.7 GB, needs 8GB+ RAM)
ollama pull mistral:7b         # Great for writing (4.1 GB)
ollama pull phi3:3.8b          # Compact, for limited hardware (2.2 GB)

# Embeddings — for semantic search
ollama pull nomic-embed-text   # Best local embeddings (274 MB)
```

### 4. Enable in FlowSpace

1. Open FlowSpace → Settings → AI Features
2. Toggle "Enable AI Features" ON
3. The server URL defaults to `http://localhost:11434`
4. Click "Test" to verify connection
5. Select your preferred LLM model
6. Pull any missing models directly from the settings UI

## File Structure

```
src/lib/ai/
├── ollama-client.ts       # Server-side Ollama REST client
├── ai-manager.ts          # Client-side AI manager (calls API routes)
├── types.ts               # Type definitions + model catalog
└── embeddings-index.ts    # Semantic search with vector caching

src/app/api/ai/
├── chat/route.ts          # POST — LLM chat (streaming + non-streaming)
├── embeddings/route.ts    # POST — Generate embeddings
├── models/route.ts        # GET — List models, POST — Pull/delete
└── status/route.ts        # GET — Ollama health check

src/lib/hooks/
├── use-ai.tsx             # AIProvider context + useAI() hook
└── use-preferences.tsx    # Stores ollamaUrl, model selections

src/components/settings/
└── settings-content.tsx   # Ollama settings UI
```

## API Routes

### POST /api/ai/chat

Generate text with an LLM model.

```json
{
  "model": "llama3.1:8b",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Summarize this text..." }
  ],
  "stream": true,
  "temperature": 0.7,
  "maxTokens": 512,
  "ollamaUrl": "http://localhost:11434"
}
```

**Non-streaming response:**
```json
{ "text": "Here is the summary...", "model": "llama3.1:8b" }
```

**Streaming response:** Server-Sent Events (SSE)
```
data: {"token": "Here"}
data: {"token": " is"}
data: {"token": " the"}
data: [DONE]
```

### POST /api/ai/embeddings

Generate vector embeddings for semantic search.

```json
{
  "model": "nomic-embed-text",
  "input": ["text to embed", "another text"],
  "ollamaUrl": "http://localhost:11434"
}
```

Response:
```json
{
  "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  "dimensions": 768
}
```

### GET /api/ai/models

List installed Ollama models.

### POST /api/ai/models

Pull or delete a model:
```json
{ "action": "pull", "model": "llama3.1:8b" }
{ "action": "delete", "model": "llama3.1:8b" }
```

### GET /api/ai/status

Health check — returns connection status and model count.

## Recommended Models by Hardware

| RAM | VRAM | Recommended LLM | Notes |
|-----|------|-----------------|-------|
| 8 GB | None | phi3:3.8b | CPU-only, basic tasks |
| 16 GB | 4 GB | mistral:7b | Good balance |
| 16 GB | 6 GB+ | llama3.1:8b | Best quality |
| 32 GB | 8 GB+ | llama3.1:8b | Fast, can also run 13B+ |

## Capabilities

### Currently Available
- **Text Generation (LLM)**: Summarize, expand, fix grammar, improve writing, continue writing, generate todos
- **Embeddings**: Semantic search across all FlowSpace content
- **Model Management**: Pull, select, and delete models from the Settings UI

### Phase 2 (Planned)
- **Text-to-Speech**: Piper TTS for natural local voice synthesis
- **Speech-to-Text**: Faster-Whisper for accurate local transcription
- **Vision**: Image understanding via multimodal Ollama models

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL (server-side fallback) |

### Preferences (stored in browser localStorage)

| Key | Default | Description |
|-----|---------|-------------|
| `ollamaUrl` | `http://localhost:11434` | Ollama server URL |
| `aiEnabled` | `false` | Enable/disable AI features |
| `aiLLMModel` | `llama3.1:8b` | Selected LLM model |
| `aiEmbeddingsModel` | `nomic-embed-text` | Selected embeddings model |

## Troubleshooting

### "Disconnected — start Ollama with: ollama serve"
Ollama is not running. Start it:
```bash
ollama serve
```
On Windows, check if the Ollama service is running in the system tray.

### "Pull failed" or model download errors
- Check your internet connection
- Verify Ollama is running: `curl http://localhost:11434`
- Try pulling from the terminal: `ollama pull llama3.1:8b`

### Slow generation
- Ensure Ollama is using your GPU: `ollama ps` shows the device
- Use a smaller model (phi3:3.8b) if hardware is limited
- Close other GPU-heavy applications

### CORS errors
The Next.js API routes act as a proxy, so CORS is not an issue. If you see CORS errors, ensure you're calling `/api/ai/*` routes, not Ollama directly.

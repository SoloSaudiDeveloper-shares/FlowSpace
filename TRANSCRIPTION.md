# Voice / audio transcription pipeline

> Phone → Telegram bot → Oracle server → FFmpeg → faster-whisper (Medium) → AI summary → save to FlowSpace

This documents the design and the **server-side setup** for transcribing audio
shared to the Telegram bot. The plan supports **both** short voice notes (fast,
inline) and **long recordings** (meetings/lectures, processed asynchronously),
with **local-first transcription and a Groq fallback**.

---

## What already works today (no setup needed)

The bot already does the short-note path end-to-end:

`voice note → bot → server downloads OGG → Whisper → smart-capture → saved`

- Transcription lives in `src/lib/telegram/voice.ts`. As of now it is
  **local-first with Groq fallback**: it POSTs the audio to the self-hosted
  faster-whisper server (`TELEGRAM_VOICE_LOCAL_URL`) first and falls back to
  Groq (`whisper-large-v3-turbo`) if the local server is down/errors/returns
  empty. Per-user key choice is handled by `resolveGroqKey()`.
- Intake already reads `message.voice` **and** `message.audio` /
  `message.video_note` file ids (webhook route), then runs the language +
  destination picker flow.

So once you point `TELEGRAM_VOICE_LOCAL_URL` at a faster-whisper server, short
notes already transcribe locally on the box for free.

---

## Media links (TikTok / YouTube / Instagram / X / …) — IMPLEMENTED

Send the bot a link to a known media host and it downloads the clip, rips the
audio, transcribes it (local-first → Groq), AI-summarizes it, and saves a todo
— then DMs you the result with an ↩️ Undo button. A pasted link to an *unknown*
host still becomes a plain todo (no surprise jobs); `/add <link>` forces a plain
save.

**Code:** `media-url.ts` (host allowlist), `media-download.ts` (yt-dlp/ffmpeg via
`execFile` — never a shell string), `media-jobs.ts` (the single-flight worker +
`transcription_jobs` queue), `summarize.ts` (map-reduce AI summary). The webhook
enqueues + acks instantly; the worker (cron job `telegram:media-capture`, plus an
on-enqueue nudge) drains one job at a time and self-heals via a DB watchdog.

**Requires `yt-dlp` on the VM** (in addition to ffmpeg). In Docker this is baked
into the image (under `/app/bin`, owned by the runtime user) and **auto-updates
itself** on boot + daily via the `media:ytdlp-update` cron — so it never goes
stale between deploys. For a bare (non-Docker) install:
```bash
pipx install yt-dlp        # apt's build is usually stale
```

**Region/IP blocks (`--cookies`):** if TikTok/YouTube starts blocking the VM's
datacenter IP, export your browser cookies to a Netscape `cookies.txt` (e.g. via
the "Get cookies.txt" browser extension), drop it on the box (e.g. the data
volume → `/data/cookies.txt`), and set `YTDLP_COOKIES_FILE=/data/cookies.txt`.
yt-dlp then authenticates like your real browser.
**Env knobs:** `MEDIA_CAPTURE_MAX_DURATION_SEC` (1800), `MEDIA_CAPTURE_MAX_FILESIZE_MB`
(500 — bounds the *source video* download, not the kept audio), `MEDIA_CAPTURE_TIMEOUT_MS`
(300000), optional `YTDLP_BIN` / `FFMPEG_BIN`. The duration cap is the real guard; only
the audio is transcribed and it's downmixed to mono 16 kHz (a few MB even for ~30 min).

**ToS:** downloading from these platforms generally violates their Terms of
Service. Fine for a single-user, self-hosted, personal tool; don't expose it as a
public multi-tenant service. The allowlist is conservative and `--no-playlist` is
always enforced.

---

## Local image captioning (Gallery / Vision) — free, on the box

The Gallery's auto-caption ("identify the image") and the in-app Vision feature
use an OpenAI-compatible vision endpoint, **local-first**: set `VISION_LOCAL_URL`
and they use a self-hosted model for free; otherwise they fall back to the user's
configured cloud model (which must be vision-capable).

Recommended light model on a CPU/ARM box: **moondream** (~1.8B, ~2 GB RAM) via
Ollama, which exposes an OpenAI-compatible API including image input.

```bash
curl -fsSL https://ollama.com/install.sh | sh   # has arm64 builds
ollama pull moondream
# Ollama serves http://127.0.0.1:11434/v1
```

Env (point the URL at wherever Ollama is reachable *from the app container* —
same gateway trick as `TELEGRAM_VOICE_LOCAL_URL`, e.g. `http://172.17.0.1:11434/v1`):
```
VISION_LOCAL_URL=http://172.17.0.1:11434/v1
VISION_LOCAL_MODEL=moondream      # default if omitted
# VISION_LOCAL_KEY=               # optional; Ollama needs none
```
Captioning runs in the background, so a few seconds–~20 s per image on CPU is
fine. Lighter still: SmolVLM (256M/500M) via llama.cpp. Want one model for chat
*and* vision instead? `gemma3:4b` / `qwen2.5vl:3b` are multimodal (heavier/slower).

---

## Server-side components to stand up (Oracle ARM VM)

### 1. FFmpeg
```bash
sudo apt-get install -y ffmpeg
```
Used to normalize any input (m4a/mp3/mp4/ogg) to **16 kHz mono WAV** and to
**chunk** long audio into ~10-minute segments for robust, resumable
transcription.

### 2. faster-whisper server (Medium model)
Run an OpenAI-compatible `/audio/transcriptions` endpoint. Recommended:
`speaches` / `faster-whisper-server` in Docker.

```bash
docker run -d --name whisper --restart unless-stopped \
  -p 127.0.0.1:8001:8000 \
  -e WHISPER__MODEL=Systran/faster-whisper-medium \
  -e WHISPER__INFERENCE_DEVICE=cpu \
  -e WHISPER__COMPUTE_TYPE=int8 \
  fedirz/faster-whisper-server:latest-cpu
```
Then set in `.env.local`:
```
TELEGRAM_VOICE_LOCAL_URL=http://127.0.0.1:8001/v1
```
**ARM/CPU note:** Medium int8 on the Ampere A1 runs roughly real-time to a few×
slower depending on cores. That's fine for the *async* long path; keep short
notes snappy by letting them fall back to Groq if the local box is busy.

### 3. Self-hosted Telegram Bot API server (only needed for files > 20 MB)
The public Bot API caps **downloads at 20 MB** — a 30-min recording won't fit.
Running your own Bot API server raises this to ~2 GB and lets the bot fetch the
file from the local filesystem (no re-download).

```bash
docker run -d --name tg-bot-api --restart unless-stopped \
  -p 127.0.0.1:8081:8081 \
  -e TELEGRAM_API_ID=<id> -e TELEGRAM_API_HASH=<hash> \
  -e TELEGRAM_LOCAL=1 \
  aiogram/telegram-bot-api:latest
```
Then point the bot client base URL at it (env: `TELEGRAM_BOT_API_BASE`,
default `https://api.telegram.org`). Get `api_id`/`api_hash` from
https://my.telegram.org.

---

## Async pipeline (long recordings) — implementation spec

Short notes stay on the existing inline path. Anything large or long is
**enqueued** and processed by a background worker so the webhook can ack in
milliseconds (Telegram retries if it doesn't).

**1. Schema** — `transcription_jobs`:
| column | notes |
|---|---|
| id | nanoid |
| user_id | owner (FlowSpace user) |
| bot_token / chat_id / message_id | to reply + fetch |
| file_id / file_unique_id / mime / size_bytes / duration | source |
| status | `queued` → `downloading` → `transcribing` → `summarizing` → `saving` → `done` / `failed` |
| language | picker value or `auto` |
| transcript / summary / error | results |
| result_element_id | the saved Page |
| created_at / updated_at | progress timestamps |

**2. Intake** (webhook): if `size_bytes > ~1 MB` or `duration > 90 s`, insert a
`transcription_jobs` row (status `queued`), reply "⏳ Transcribing your
recording — I'll send the summary here when it's done," and return 200
immediately. Small notes keep the current instant flow.

**3. Worker** (new cron job, single-flight): claim one `queued` job, then
- download (local Bot API filesystem if huge, else `getFile`),
- `ffmpeg -i in -ac 1 -ar 16000 -f wav` → split into ~10-min chunks,
- transcribe each chunk **local-first → Groq fallback** (reuse `voice.ts`),
- concatenate transcripts,
- **AI summary** via the user's configured provider (`openaiGenerate`):
  map-reduce when the transcript exceeds the model context (summarize each
  chunk, then summarize the summaries) — TL;DR + key points + action items,
- create a **Page** (`createElement("page")`) titled from the summary, body =
  summary + collapsible full transcript; optionally extract action items as
  tasks,
- mark `done`, store `result_element_id`, and DM the user a deep link.
Guard with an `isProcessing` flag so only one heavy job runs at a time and a
crashed job re-queues (status + `updated_at` watchdog).

**4. AI summary settings:** reuse `preferences.aiTokenBudgets`; add a per-user
toggle "Summarize long transcripts" (default on for the async path, off for
short notes where the raw text is the point).

---

## Cost / privacy summary

| | Local (faster-whisper Medium) | Groq fallback |
|---|---|---|
| Cost | free (your CPU) | per-minute |
| Privacy | audio never leaves the VM | sent to Groq |
| Speed (ARM CPU) | ~realtime–few× slower | very fast |
| Long files | ✅ (async) | 25 MB cap |

Default: **local-first**, Groq only when local is down or for snappy short
notes. This matches the configured engine preference.

# Self-hosted faster-whisper on the Oracle VM

Stop paying Groq (or sharing a workspace API key) by running Whisper
on the VM. Adds ~2 GB RAM and ~5-15s latency per voice note compared
to Groq, but the audio never leaves your server.

## What you'll deploy

A small FastAPI service that wraps [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
behind an OpenAI-compatible `/v1/audio/transcriptions` endpoint. This
means FlowSpace's existing transcription code keeps working — only the
base URL changes.

## Sidecar Docker setup (recommended)

```yaml
# docker-compose.whisper.yml — run alongside the existing FlowSpace stack
services:
  whisper:
    image: ghcr.io/fedirz/faster-whisper-server:latest-cpu
    environment:
      WHISPER__MODEL: Systran/faster-whisper-small  # 244 MB, en+multi
      WHISPER__INFERENCE_DEVICE: cpu
      WHISPER__COMPUTE_TYPE: int8
      ENABLE_UI: "false"
    ports:
      - "127.0.0.1:8001:8000"
    restart: unless-stopped
    volumes:
      - whisper-models:/root/.cache/huggingface
    deploy:
      resources:
        limits:
          memory: 2G

volumes:
  whisper-models:
```

For GPU machines swap the image to `ghcr.io/fedirz/faster-whisper-server:latest-cuda`
and the device to `cuda`. Switch the model to `Systran/faster-whisper-large-v3`
for top-tier accuracy at the cost of 3 GB VRAM.

## Caddy proxy

```caddy
# /etc/caddy/Caddyfile — under the existing flowspace block
:443 {
    # ... existing FlowSpace config ...

    # Voice STT only — bind to localhost so it's not internet-reachable.
    # We hit it from the FlowSpace process via http://127.0.0.1:8001.
    # No public exposure needed.
}
```

That's it. No public Caddy route — FlowSpace talks to the sidecar over
the host's loopback.

## Wire FlowSpace to use it

In Settings → Speech → Engine, the user currently picks Groq. Add a
new engine option "Local server" with a base-URL field defaulting to
`http://127.0.0.1:8001/v1`. The transcription code already treats
Groq as an OpenAI-compatible endpoint, so swapping the base URL is
the only change.

For the Telegram bot's voice path, set
`TELEGRAM_VOICE_BACKEND=local` and
`TELEGRAM_VOICE_LOCAL_URL=http://127.0.0.1:8001/v1` in the env file —
the existing voice module reads the base URL the same way.

## Deploy steps

```bash
# 1. SSH in
ssh -i ~/.ssh/flowspace ubuntu@145.241.153.186

# 2. Pull the sidecar compose file
cd /opt/flowspace
nano docker-compose.whisper.yml   # paste the YAML above

# 3. Start it
docker compose -f docker-compose.whisper.yml up -d

# 4. Verify (model download takes 30-60s on first start)
curl -s -F "file=@/tmp/test.ogg" \
     -F "model=Systran/faster-whisper-small" \
     http://127.0.0.1:8001/v1/audio/transcriptions

# 5. Restart FlowSpace so it picks up the new env vars
sudo systemctl restart flowspace
```

## Trade-offs

| | Groq cloud | Self-hosted small | Self-hosted large |
|-|-----------|-------------------|-------------------|
| Latency (3s clip) | ~0.5s | ~3s | ~8s |
| Latency (30s clip) | ~1.5s | ~12s | ~30s |
| Accuracy (English) | excellent | good | excellent |
| Accuracy (Arabic) | excellent | acceptable | very good |
| Cost | $0.04/hr audio | RAM only | RAM + ~3 GB VRAM |
| Privacy | audio leaves machine | audio never leaves machine | audio never leaves machine |

## Migration plan

Phase 1: ship the sidecar; keep Groq as the default in Settings.
Phase 2: A/B for a week — log which engine each user picks.
Phase 3: flip the default to local for new bot connections.
Phase 4: deprecate the shared `TELEGRAM_VOICE_GROQ_KEY` env var.

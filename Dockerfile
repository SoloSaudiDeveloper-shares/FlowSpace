# FlowSpace deployment Dockerfile (Railway / Fly / Render)
# Multi-stage build, ends in a slim image that runs `node server.js` from
# Next.js standalone output. Persistent data lives in /data — mount a
# volume there on the host.

# ─── Stage 1: dependencies ──────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 is a native module — needs a compiler toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ─── Stage 2: build the standalone bundle ───────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runtime ───────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# All SQLite + uploads + backups land under /data, which the host mounts as a volume.
ENV DATA_DIR=/data

# ffmpeg + yt-dlp power the media-link capture feature (share a TikTok/YouTube
# link to the Telegram bot → download, transcribe, summarize). The long-audio
# upload path does NOT need these (it streams bytes straight to Whisper), so a
# failed yt-dlp download here only disables link capture, not the whole app.
# yt-dlp ships self-contained PyInstaller binaries per-arch (bundle their own
# Python), so we fetch the one matching the build architecture. We install it
# under /app/bin (owned by the runtime user below) rather than /usr/local/bin,
# so the app can self-update it at runtime (yt-dlp --update) and never go stale
# between deploys — TikTok/IG change often and yt-dlp ships fixes weekly.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates curl \
    && mkdir -p /app/bin \
    && arch="$(dpkg --print-architecture)" \
    && if [ "$arch" = "arm64" ]; then ytasset=yt-dlp_linux_aarch64; else ytasset=yt-dlp_linux; fi \
    && (curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytasset}" -o /app/bin/yt-dlp \
        && chmod a+rx /app/bin/yt-dlp \
        || echo "WARN: yt-dlp download failed — media-link capture will be disabled until re-deployed") \
    && rm -rf /var/lib/apt/lists/*
ENV YTDLP_BIN=/app/bin/yt-dlp

# Create a non-root user for security. The chown of /app also makes
# /app/bin/yt-dlp writable by the runtime user so it can self-update.
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs && \
    mkdir -p /data && chown -R nextjs:nodejs /data /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]

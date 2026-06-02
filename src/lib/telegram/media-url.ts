/**
 * Media-URL detection for the Telegram bot.
 *
 * When a user texts a link to a known media host (TikTok, YouTube, etc.),
 * we want to download the clip, transcribe it, and capture a summary. This
 * module ONLY decides whether a message contains such a link — it does no
 * I/O. The actual download lives in `media-download.ts`.
 *
 * Design notes:
 *   - We match the FIRST http(s) URL in the message against a curated
 *     allowlist of media hosts. Anything else (a news article, a bare
 *     word, an unknown host) returns null so the caller falls through to
 *     normal smart-capture — a pasted link still becomes a plain todo.
 *   - Host matching is suffix-based with a leading-dot guard so
 *     `tiktok.com.evil.example` does NOT match `tiktok.com`.
 *   - This is the security allowlist that bounds what yt-dlp will ever be
 *     pointed at, so keep it conservative.
 */

import "server-only"

export interface DetectedMediaUrl {
  /** The canonical URL string (as found in the message). */
  url: string
  /** The normalized hostname (lowercased, `www.`/`m.` stripped). */
  host: string
  /** Friendly platform label for replies, e.g. "YouTube", "TikTok". */
  platform: string
}

/** host suffix → platform label. Order doesn't matter; first match wins. */
const ALLOWLIST: { host: string; platform: string }[] = [
  { host: "tiktok.com", platform: "TikTok" },
  { host: "youtube.com", platform: "YouTube" },
  { host: "youtu.be", platform: "YouTube" },
  { host: "instagram.com", platform: "Instagram" },
  { host: "x.com", platform: "X" },
  { host: "twitter.com", platform: "X" },
  { host: "t.co", platform: "X" },
  { host: "facebook.com", platform: "Facebook" },
  { host: "fb.watch", platform: "Facebook" },
  { host: "vimeo.com", platform: "Vimeo" },
  { host: "soundcloud.com", platform: "SoundCloud" },
  { host: "twitch.tv", platform: "Twitch" },
  { host: "dailymotion.com", platform: "Dailymotion" },
]

/** Normalize a hostname: lowercase, drop a leading `www.`/`m.`/`vm.`/`vt.`. */
function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www|m|vm|vt|mobile)\./, "")
}

/** True if `host` is the allowlisted host or a subdomain of it. The
 *  leading-dot check prevents `tiktok.com.evil.example` from matching. */
function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith("." + allowed)
}

/**
 * Scan `text` for the first http(s) URL pointing at an allowlisted media
 * host. Returns the match or null. Pure — no network, no DB.
 */
export function detectMediaUrl(text: string): DetectedMediaUrl | null {
  if (!text) return null
  // Conservative URL extraction: grab http(s) tokens, then validate each
  // with the URL parser (which rejects malformed ones by throwing).
  const candidates = text.match(/https?:\/\/[^\s<>"')]+/gi)
  if (!candidates) return null

  for (const raw of candidates) {
    // Trim trailing punctuation that commonly clings to pasted links.
    const cleaned = raw.replace(/[.,;!?)\]]+$/, "")
    let parsed: URL
    try {
      parsed = new URL(cleaned)
    } catch {
      continue
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue
    const host = normalizeHost(parsed.hostname)
    const hit = ALLOWLIST.find((a) => hostMatches(host, a.host))
    if (hit) {
      return { url: parsed.toString(), host, platform: hit.platform }
    }
  }
  return null
}

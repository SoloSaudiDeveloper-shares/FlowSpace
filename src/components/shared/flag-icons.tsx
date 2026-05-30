/**
 * Flag icons — render the OFFICIAL flag SVGs (from the public-domain
 * `flag-icons` set) served as static assets from /public/flags.
 *
 * We deliberately do NOT use emoji flags (🇺🇸 / 🇸🇦): Windows + Chrome
 * don't draw them, they fall back to the bare country code "US"/"SA".
 * The SVGs are accurate — the Saudi flag carries the real Shahada
 * calligraphy and sword, not a stylised approximation.
 *
 * The source flags are 4:3, so we render a rounded rectangle at that
 * aspect ratio (height = width * 0.75) rather than forcing a square.
 */

interface FlagProps {
  className?: string
  /** Flag width in px (default 20). Height is auto at the 4:3 ratio. */
  size?: number
}

function Flag({ src, label, className = "", size = 20 }: FlagProps & { src: string; label: string }) {
  return (
    <span
      className={`inline-block overflow-hidden rounded-[3px] ring-1 ring-black/10 shrink-0 ${className}`}
      style={{ width: size, height: Math.round(size * 0.75) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        width={size}
        height={Math.round(size * 0.75)}
        className="block w-full h-full object-cover"
        draggable={false}
      />
    </span>
  )
}

/** United States flag (official SVG). */
export function USFlag({ className, size }: FlagProps) {
  return <Flag src="/flags/us.svg" label="English (United States)" className={className} size={size} />
}

/** Saudi Arabia flag (official SVG — real Shahada calligraphy + sword). */
export function SaudiFlag({ className, size }: FlagProps) {
  return <Flag src="/flags/sa.svg" label="العربية (Saudi Arabia)" className={className} size={size} />
}

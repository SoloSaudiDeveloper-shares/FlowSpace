/**
 * Inline SVG flag icons.
 *
 * We render flags as SVG, NOT emoji (🇺🇸 / 🇸🇦), because Windows + Chrome
 * don't draw flag emoji — they fall back to the two-letter country code
 * ("US" / "SA"). SVG renders identically on every OS and stays crisp at
 * any size.
 *
 * These are simplified — recognisable at 16-24px, not pixel-accurate
 * vexillology. Rounded corners via the wrapper's overflow-hidden.
 */

interface FlagProps {
  className?: string
  /** pixel size of the square viewport (default 20) */
  size?: number
}

/** United States — 13 stripes + blue canton with a star cluster. */
export function USFlag({ className = "", size = 20 }: FlagProps) {
  return (
    <span
      className={`inline-block overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 20 20" width={size} height={size} role="img" aria-label="English (United States)">
        {/* white background */}
        <rect width="20" height="20" fill="#fff" />
        {/* red stripes (7 of 13, spread across the square) */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x="0" y={i * (20 / 13) * 2} width="20" height={20 / 13} fill="#B22234" />
        ))}
        {/* blue canton */}
        <rect width="9" height={20 / 13 * 7} fill="#3C3B6E" />
        {/* a few stars suggested with white dots */}
        {[
          [1.6, 1.4], [3.6, 1.4], [5.6, 1.4], [7.6, 1.4],
          [2.6, 3.2], [4.6, 3.2], [6.6, 3.2],
          [1.6, 5.0], [3.6, 5.0], [5.6, 5.0], [7.6, 5.0],
          [2.6, 6.8], [4.6, 6.8], [6.6, 6.8],
          [1.6, 8.6], [3.6, 8.6], [5.6, 8.6], [7.6, 8.6],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="0.55" fill="#fff" />
        ))}
      </svg>
    </span>
  )
}

/** Saudi Arabia — green field, white shahada (suggested) + sword. */
export function SaudiFlag({ className = "", size = 20 }: FlagProps) {
  return (
    <span
      className={`inline-block overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 20 20" width={size} height={size} role="img" aria-label="العربية (Saudi Arabia)">
        {/* green field */}
        <rect width="20" height="20" fill="#1E7A3D" />
        {/* shahada script — suggested with a thin white wavy line */}
        <path
          d="M3 8 q1.5 -1.2 3 0 q1.5 1.2 3 0 q1.5 -1.2 3 0 q1.5 1.2 3 0"
          fill="none"
          stroke="#fff"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        {/* sword — horizontal blade with a small hilt on the right */}
        <line x1="3.2" y1="12.5" x2="15.5" y2="12.5" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="15.2" y1="11.6" x2="15.2" y2="13.4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </span>
  )
}

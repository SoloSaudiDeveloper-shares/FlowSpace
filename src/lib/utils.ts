import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escape a string for safe interpolation into HTML text or attribute context.
 * Single source of truth — several modules previously kept their own copies,
 * one of which omitted the `'` escape (weakening attribute-context safety).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Alias for attribute context — same rules, clearer intent at call sites. */
export const escapeAttr = escapeHtml

/**
 * Template engine for "send anything as email".
 *
 * Templates are HTML/text with `{{variable}}` placeholders. The engine
 * resolves variables from a context object using a dotted path:
 *   {{element.title}}
 *   {{element.dueDate}}
 *   {{tasks.open.count}}
 *   {{user.displayName}}
 *
 * It also supports a simple block syntax for conditionals:
 *   {{#if tasks.open.count}}...{{/if}}
 *   {{#each tasks.open.items}}{{this.title}}{{/each}}
 *
 * No external dependency — Handlebars/Mustache would be overkill for
 * the small surface we need, and we want to ship templates as inline
 * strings without compilation steps.
 */

import "server-only"

export interface TemplateContext {
  [key: string]: unknown
}

/** Look up a value in `ctx` by a dotted path. Returns "" when missing. */
function lookup(ctx: TemplateContext, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = ctx
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return ""
    }
  }
  return cur ?? ""
}

/** Escape HTML to keep the template safe against context with markup. */
function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Render the template against the context.
 *
 * Two flavors:
 *  - HTML: variables are HTML-escaped.
 *  - TEXT: variables are inserted as-is.
 */
export function renderTemplate(
  template: string,
  ctx: TemplateContext,
  options: { html?: boolean } = {},
): string {
  const escape = options.html ? escapeHtml : (s: unknown) => String(s)

  // 1. {{#each path}}...{{/each}} — iterate over arrays
  let out = template.replace(
    /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, path: string, body: string) => {
      const arr = lookup(ctx, path)
      if (!Array.isArray(arr) || arr.length === 0) return ""
      return arr
        .map((item) => renderTemplate(body, { ...ctx, this: item }, options))
        .join("")
    },
  )

  // 2. {{#if path}}...{{/if}} — truthy block
  out = out.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, path: string, body: string) => {
      const v = lookup(ctx, path)
      const truthy =
        v !== null && v !== undefined && v !== "" && v !== 0 && v !== false
      return truthy ? renderTemplate(body, ctx, options) : ""
    },
  )

  // 3. {{path}} — variable interpolation
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    return escape(lookup(ctx, path))
  })

  return out
}

/** Extract all `{{variable}}` paths in a template — useful for showing a
 * variable picker in the composer UI. */
export function extractVariables(template: string): string[] {
  const found = new Set<string>()
  const re = /\{\{([\w.]+)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    if (!m[1].startsWith("#") && !m[1].startsWith("/")) found.add(m[1])
  }
  return Array.from(found)
}

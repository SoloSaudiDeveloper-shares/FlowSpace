/**
 * Built-in templates for "send element as email".
 *
 * Each template has:
 *  - id        — unique short slug
 *  - label     — shown in the picker
 *  - elementTypes — which types this template applies to
 *  - subject   — template for the subject line
 *  - body      — HTML template
 *
 * The template engine resolves `{{element.title}}` etc. against the
 * context the server action builds. User-defined templates live in the
 * `email_templates` DB table and have the same shape.
 */

export interface EmailTemplate {
  id: string
  label: string
  description: string
  elementTypes: Array<"project" | "page" | "canvas" | "todo_list" | "reminder" | "process" | "task">
  subject: string
  body: string
}

// Shared style block — keeps every template visually consistent.
const STYLE = `
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a; }
  .wrap { background:#f1f5f9; padding:32px 16px; }
  .card { max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
  .pad { padding:28px 32px; }
  .label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#64748b; margin-bottom:10px; }
  h1 { margin:0 0 12px 0; font-size:22px; line-height:1.3; color:#0f172a; }
  .desc { margin:20px 0; padding:14px 16px; background:#f8fafc; border-left:3px solid #94a3b8; border-radius:4px; color:#334155; font-size:14px; line-height:1.6; white-space:pre-wrap; }
  .note { margin:0 0 24px 0; padding:14px 16px; background:#eff6ff; border-left:3px solid #3b82f6; border-radius:4px; color:#1e3a8a; font-size:14px; line-height:1.6; white-space:pre-wrap; }
  .note-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#1d4ed8; margin-bottom:6px; }
  .pill { display:inline-block; padding:2px 10px; border-radius:9999px; font-size:12px; font-weight:600; margin-right:4px; }
  table.meta { margin:8px 0 4px 0; font-size:13px; width:100%; }
  table.meta td { padding:4px 16px 4px 0; vertical-align:top; }
  table.meta td.k { color:#64748b; font-size:13px; width:120px; }
  .button { display:inline-block; padding:10px 18px; background:#0f172a; color:#fff; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; }
  .footer { padding:20px 32px 28px 32px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:11px; line-height:1.5; }
  ul.tasks { padding-left:18px; margin:10px 0; }
  ul.tasks li { margin:4px 0; color:#334155; font-size:14px; }
`

const WRAPPER_OPEN = `<!doctype html><html><body><style>${STYLE}</style><div class="wrap"><div class="card"><div class="pad">`
const WRAPPER_CLOSE = `</div><div class="footer">Sent from <strong style="color:#475569">FlowSpace</strong> by {{user.displayName}}.</div></div></div></body></html>`

export const BUILTIN_TEMPLATES: EmailTemplate[] = [
  // ── Universal ────────────────────────────────────────────────────
  {
    id: "simple",
    label: "Simple — just the basics",
    description: "Title, a one-line description, and a button back to FlowSpace. Works for any element.",
    elementTypes: ["project", "page", "canvas", "todo_list", "reminder", "process", "task"],
    subject: "{{element.title}}",
    body: `${WRAPPER_OPEN}
<div class="label">{{element.typeLabel}}</div>
<h1>{{element.title}}</h1>
{{#if customMessage}}<div class="note"><div class="note-label">Message from {{user.displayName}}</div>{{customMessage}}</div>{{/if}}
{{#if element.description}}<div class="desc">{{element.description}}</div>{{/if}}
{{#if links.element}}<div style="margin-top:24px"><a href="{{links.element}}" class="button">Open in FlowSpace</a></div>{{/if}}
${WRAPPER_CLOSE}`,
  },

  // ── Project status update ────────────────────────────────────────
  {
    id: "project-status",
    label: "Project — status update",
    description: "Project title, status, progress %, due date, open task count + first 5 by priority.",
    elementTypes: ["project"],
    subject: "{{element.title}} — status update",
    body: `${WRAPPER_OPEN}
<div class="label">Project update</div>
<h1>{{element.title}}</h1>
{{#if customMessage}}<div class="note"><div class="note-label">From {{user.displayName}}</div>{{customMessage}}</div>{{/if}}
<table class="meta">
  <tr><td class="k">Status</td><td>{{element.status}}</td></tr>
  <tr><td class="k">Progress</td><td>{{element.progress}}%</td></tr>
  {{#if element.dueDate}}<tr><td class="k">Due</td><td>{{element.dueDate}}</td></tr>{{/if}}
  <tr><td class="k">Tasks</td><td>{{tasks.done.count}}/{{tasks.total.count}} done · {{tasks.open.count}} open</td></tr>
</table>
{{#if tasks.open.items}}<div style="margin-top:14px"><div class="label">Top open tasks</div><ul class="tasks">{{#each tasks.open.items}}<li>{{this.title}}</li>{{/each}}</ul></div>{{/if}}
{{#if element.description}}<div class="desc">{{element.description}}</div>{{/if}}
{{#if links.element}}<div style="margin-top:24px"><a href="{{links.element}}" class="button">Open project</a></div>{{/if}}
${WRAPPER_CLOSE}`,
  },

  // ── Todo list digest ─────────────────────────────────────────────
  {
    id: "todo-digest",
    label: "Todo list — digest",
    description: "Full list with checked items struck through. Good for sharing a checklist.",
    elementTypes: ["todo_list"],
    subject: "{{element.title}} — checklist",
    body: `${WRAPPER_OPEN}
<div class="label">Checklist</div>
<h1>{{element.title}}</h1>
{{#if customMessage}}<div class="note">{{customMessage}}</div>{{/if}}
<ul class="tasks">{{#each items.all}}<li>{{#if this.isCompleted}}<s style="color:#94a3b8">{{this.title}}</s>{{/if}}{{#if this.isCompleted}}{{/if}}{{#if this.isCompleted}}{{/if}}{{#if this.title}}{{this.title}}{{/if}}</li>{{/each}}</ul>
{{#if links.element}}<div style="margin-top:24px"><a href="{{links.element}}" class="button">Open list</a></div>{{/if}}
${WRAPPER_CLOSE}`,
  },

  // ── Reminder ping ────────────────────────────────────────────────
  {
    id: "reminder-ping",
    label: "Reminder — short ping",
    description: "Concise reminder with due date and link.",
    elementTypes: ["reminder"],
    subject: "Reminder: {{element.title}}",
    body: `${WRAPPER_OPEN}
<div class="label">Reminder</div>
<h1>{{element.title}}</h1>
{{#if element.remindAt}}<p style="color:#64748b; font-size:14px">Due: {{element.remindAt}}</p>{{/if}}
{{#if customMessage}}<div class="note">{{customMessage}}</div>{{/if}}
{{#if links.element}}<div style="margin-top:24px"><a href="{{links.element}}" class="button">Open in FlowSpace</a></div>{{/if}}
${WRAPPER_CLOSE}`,
  },
]

export function getTemplatesForType(
  type: "project" | "page" | "canvas" | "todo_list" | "reminder" | "process" | "task",
): EmailTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.elementTypes.includes(type))
}

/**
 * Parser for the FlowSpace AI-import Markdown format.
 *
 * The goal: give people a structured prompt to paste into Claude/ChatGPT
 * after brainstorming. The AI outputs Markdown in this exact shape, the
 * user pastes it into FlowSpace, and we materialize a real element +
 * tasks/notes without them lifting a finger.
 *
 * Format (line-by-line, lenient on whitespace, ignores blank lines):
 *
 *   # Project: NorthStar                  ← required header; type ∈
 *                                            project | page | todo | canvas
 *                                            | reminder | process
 *   Status: active                        ← optional, projects only
 *   Due: 2026-07-15                       ← optional
 *   Tags: work, build, unity-hub          ← optional, comma-separated
 *
 *   ## Tasks                              ← optional section
 *   - [x] Audit existing exports          ← completed
 *   - [ ] (high) Extract toolkits         ← optional priority in parens
 *   - [ ] @2026-06-15 Stage in Hub        ← optional @YYYY-MM-DD due date
 *   - [ ] (urgent) @2026-06-20 Verify     ← order of (priority) and @date
 *                                            doesn't matter
 *
 *   ## Steps                              ← alias for ## Tasks, used in
 *                                            "# Process:" blocks
 *
 *   ## Notes                              ← optional; lines below become
 *                                            description / page body
 *   Any markdown content here…
 *
 * The parser is forgiving — anything it doesn't recognize falls into a
 * "warnings" array so the UI can show the user what was skipped without
 * blowing up the import.
 */

export type ImportElementType =
  | "project"
  | "page"
  | "todo"
  | "canvas"
  | "reminder"
  | "process"

export type ImportPriority = "urgent" | "high" | "medium" | "low" | "none"

export interface ParsedTask {
  title: string
  isCompleted: boolean
  priority: ImportPriority
  dueDate: string | null // ISO YYYY-MM-DD or null
}

export interface ParsedImport {
  type: ImportElementType
  title: string
  status: "planning" | "active" | "paused" | "completed" | null
  dueDate: string | null
  tags: string[]
  tasks: ParsedTask[]
  notes: string // empty string if no notes section
  warnings: string[]
}

const HEADER_RE = /^#\s+(project|page|todo|todos|todo_list|canvas|reminder|process)\s*[:\-—]\s*(.+?)\s*$/i
const PRIORITY_RE = /\(([a-z]+)\)/i
const DUE_RE = /@(\d{4}-\d{2}-\d{2})/

/** Parse a Markdown document into an importable shape. */
export function parseAIImport(markdown: string): ParsedImport | null {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const warnings: string[] = []

  // ── 1. Find the header line — the first one that matches `# Type: Title` ──
  let headerIdx = -1
  let type: ImportElementType = "project"
  let title = ""
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADER_RE)
    if (m) {
      const rawType = m[1].toLowerCase()
      type = normalizeType(rawType)
      title = m[2].trim()
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1 || !title) return null

  // ── 2. Metadata lines (Status:, Due:, Tags:) until the first `##` section ──
  let i = headerIdx + 1
  let status: ParsedImport["status"] = null
  let dueDate: string | null = null
  const tags: string[] = []
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.startsWith("##")) break
    if (line === "") {
      i++
      continue
    }
    const kv = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/)
    if (kv) {
      const key = kv[1].toLowerCase()
      const val = kv[2].trim()
      if (key === "status") {
        const s = val.toLowerCase()
        if (["planning", "active", "paused", "completed"].includes(s)) {
          status = s as ParsedImport["status"]
        } else {
          warnings.push(`Unknown status "${val}" — ignored.`)
        }
      } else if (key === "due" || key === "duedate") {
        const d = parseDateLoose(val)
        if (d) dueDate = d
        else warnings.push(`Couldn't parse due date "${val}".`)
      } else if (key === "tags" || key === "labels") {
        for (const t of val.split(",")) {
          const cleaned = t.trim().toLowerCase().replace(/\s+/g, "-")
          if (cleaned) tags.push(cleaned)
        }
      } else {
        // Unknown metadata key — flag but don't fail.
        warnings.push(`Ignored metadata: "${line}".`)
      }
    } else {
      // Non-key:value line before any ## section — fall through as part of
      // an implicit "Notes" preamble.
      break
    }
    i++
  }

  // ── 3. Walk sections (## Tasks / ## Steps / ## Notes) ────────────────
  const tasks: ParsedTask[] = []
  let notes = ""
  let currentSection: "tasks" | "notes" | null = null

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith("##")) {
      const heading = trimmed.replace(/^##+/, "").trim().toLowerCase()
      if (/^(tasks?|steps?|todos?|to-?do)$/.test(heading)) {
        currentSection = "tasks"
      } else if (/^(notes?|description|details?|body)$/.test(heading)) {
        currentSection = "notes"
      } else {
        // Unknown section — treat as notes so the content isn't lost.
        currentSection = "notes"
        notes += `## ${heading}\n`
        warnings.push(`Unknown section "## ${heading}" — kept as notes.`)
      }
      i++
      continue
    }

    if (currentSection === "tasks") {
      const t = parseTaskLine(trimmed)
      if (t) tasks.push(t)
      // Anything else (blank, freeform) is ignored inside Tasks.
    } else {
      // We're either in a Notes section, or there's loose content above
      // the first section — accumulate it as notes either way so nothing
      // the user typed gets lost.
      notes += line + "\n"
    }
    i++
  }

  return {
    type,
    title,
    status,
    dueDate,
    tags,
    tasks,
    notes: notes.trim(),
    warnings,
  }
}

// ── helpers ──────────────────────────────────────────────────────────

function normalizeType(s: string): ImportElementType {
  if (s === "todos" || s === "todo_list" || s === "todo") return "todo"
  if (
    s === "project" ||
    s === "page" ||
    s === "canvas" ||
    s === "reminder" ||
    s === "process"
  ) {
    return s as ImportElementType
  }
  return "project"
}

/** Parse a `- [ ] (priority) @YYYY-MM-DD title` line. */
function parseTaskLine(line: string): ParsedTask | null {
  const m = line.match(/^[-*]\s*\[([ xX✓])\]\s*(.+)$/)
  if (!m) return null
  const isCompleted = m[1] !== " "
  let rest = m[2].trim()

  let priority: ImportPriority = "none"
  const pm = rest.match(PRIORITY_RE)
  if (pm) {
    const p = pm[1].toLowerCase()
    if (["urgent", "high", "medium", "low"].includes(p)) {
      priority = p as ImportPriority
    }
    rest = rest.replace(PRIORITY_RE, "").replace(/\s{2,}/g, " ").trim()
  }

  let dueDate: string | null = null
  const dm = rest.match(DUE_RE)
  if (dm) {
    dueDate = dm[1]
    rest = rest.replace(DUE_RE, "").replace(/\s{2,}/g, " ").trim()
  }

  if (!rest) return null
  return { title: rest, isCompleted, priority, dueDate }
}

/** Accept a few date shapes — "2026-07-15", "July 15 2026", etc. — and
 *  emit ISO `YYYY-MM-DD`. Returns null if we can't make sense of it. */
function parseDateLoose(s: string): string | null {
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// ─── AI prompt template ────────────────────────────────────────────────
//
// What gets copied to the clipboard when the user clicks "Copy AI prompt".
// Designed so the model produces *only* the markdown, no preamble.

export const AI_PROMPT_TEMPLATE = `You're helping me organize work in FlowSpace, a project-management app.

Take everything we just discussed and output it in FlowSpace's import format below. Output ONLY the Markdown, no preamble, no explanation, no code fences.

## Format

\`\`\`
# Project: <title>
Status: planning | active | paused | completed
Due: YYYY-MM-DD
Tags: comma, separated, lowercase

## Tasks
- [ ] (high) @2026-06-20 Task with a priority and a due date
- [ ] (medium) Task with just a priority
- [ ] @2026-07-01 Task with just a due date
- [x] Completed task
- [ ] Plain task

## Notes
Any free-form notes about the project. Multiple paragraphs are fine.
- Bullets are fine here too.
\`\`\`

## Rules

- The first line MUST be \`# <Type>: <title>\`. Type can be one of: \`Project\`, \`Page\`, \`Todo\`, \`Canvas\`, \`Reminder\`, \`Process\`.
- For \`# Page:\` skip the Tasks section — everything below the header becomes the page body.
- Priorities allowed: \`urgent\`, \`high\`, \`medium\`, \`low\`. Omit for none.
- Dates use ISO \`YYYY-MM-DD\` only.
- Don't wrap the output in code fences (\`\`\`).
- Don't add any commentary before or after.

Now produce the markdown for the work we discussed.`

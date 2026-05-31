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

/** A task line's own fields (also the shape of a subtask). */
export interface ParsedTaskLine {
  title: string
  isCompleted: boolean
  priority: ImportPriority
  dueDate: string | null // ISO YYYY-MM-DD or null
  estimateMinutes: number | null
}

export interface ParsedChecklist {
  name: string
  items: { title: string; isCompleted: boolean }[]
}

export interface ParsedTask extends ParsedTaskLine {
  /** Nested tasks (one level), from indented checkbox lines. */
  subtasks: ParsedTaskLine[]
  /** Checklists, from indented `Checklist: …` blocks. */
  checklists: ParsedChecklist[]
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
// Inline estimate token: ~30m, ~2h, ~1h30m
const EST_RE = /~(\d+\s*h\s*\d+\s*m|\d+\s*h|\d+\s*m)\b/i
const CHECKLIST_RE = /^checklist\s*:\s*(.+)$/i
const ESTIMATE_LINE_RE = /^estimate\s*:\s*(.+)$/i

function parseEstimate(s: string): number | null {
  let mins = 0
  const h = s.match(/(\d+)\s*h/i)
  if (h) mins += parseInt(h[1], 10) * 60
  const m = s.match(/(\d+)\s*m/i)
  if (m) mins += parseInt(m[1], 10)
  return mins > 0 ? mins : null
}

/** Leading-whitespace width (tabs count as 2). */
function indentOf(line: string): number {
  const ws = line.slice(0, line.length - line.trimStart().length)
  return ws.replace(/\t/g, "  ").length
}

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
  //
  // Inside ## Tasks we track indentation: a non-indented checkbox line is a
  // top-level task; an indented one is a subtask of the task above it (or, if
  // it follows an indented `Checklist: …` line, an item of that checklist).
  const tasks: ParsedTask[] = []
  let notes = ""
  let currentSection: "tasks" | "notes" | null = null
  let currentTask: ParsedTask | null = null
  let currentChecklist: ParsedChecklist | null = null

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
        currentSection = "notes"
        notes += `## ${heading}\n`
        warnings.push(`Unknown section "## ${heading}" — kept as notes.`)
      }
      currentTask = null
      currentChecklist = null
      i++
      continue
    }

    if (currentSection === "tasks") {
      if (trimmed !== "") {
        const indented = indentOf(line) >= 2
        const clMatch = trimmed.match(CHECKLIST_RE)
        const estMatch = trimmed.match(ESTIMATE_LINE_RE)
        if (indented && clMatch && currentTask) {
          currentChecklist = { name: clMatch[1].trim(), items: [] }
          currentTask.checklists.push(currentChecklist)
        } else if (indented && estMatch && currentTask) {
          currentTask.estimateMinutes = parseEstimate(estMatch[1])
        } else {
          const t = parseTaskLine(trimmed)
          if (t) {
            if (indented && currentTask) {
              if (currentChecklist) {
                currentChecklist.items.push({ title: t.title, isCompleted: t.isCompleted })
              } else {
                currentTask.subtasks.push(t)
              }
            } else {
              currentTask = { ...t, subtasks: [], checklists: [] }
              currentChecklist = null
              tasks.push(currentTask)
            }
          }
          // else: unrecognized line inside Tasks — ignored.
        }
      }
    } else {
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

/**
 * Parse a task line. The canonical form is
 *   `- [ ] (priority) @YYYY-MM-DD title`
 * but we're deliberately forgiving: weaker models routinely drop the `[ ]`
 * checkbox, so inside a Tasks section a plain bullet or numbered item
 * (`- title`, `* title`, `1. title`) is accepted as an open task too —
 * otherwise those lines would be silently lost.
 */
function parseTaskLine(line: string): ParsedTaskLine | null {
  let isCompleted = false
  let rest: string

  // Preferred form: a checkbox bullet — - [ ] / - [x] / * [X] / • [✓]
  const cb = line.match(/^[-*•]\s*\[([ xX✓])\]\s*(.+)$/)
  if (cb) {
    isCompleted = cb[1] !== " "
    rest = cb[2].trim()
  } else {
    // Fallback: a plain bullet or numbered item with no checkbox.
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/)
    if (!bullet) return null
    rest = bullet[1].trim()
  }

  // Priority — only strip the parens when the word is an actual priority, so
  // titles like "Call client (Acme)" keep their parenthetical.
  let priority: ImportPriority = "none"
  const pm = rest.match(PRIORITY_RE)
  if (pm && ["urgent", "high", "medium", "low"].includes(pm[1].toLowerCase())) {
    priority = pm[1].toLowerCase() as ImportPriority
    rest = rest.replace(pm[0], "").replace(/\s{2,}/g, " ").trim()
  }

  let dueDate: string | null = null
  const dm = rest.match(DUE_RE)
  if (dm) {
    dueDate = dm[1]
    rest = rest.replace(DUE_RE, "").replace(/\s{2,}/g, " ").trim()
  }

  // Inline estimate token: ~30m / ~2h / ~1h30m
  let estimateMinutes: number | null = null
  const em = rest.match(EST_RE)
  if (em) {
    estimateMinutes = parseEstimate(em[1])
    rest = rest.replace(em[0], "").replace(/\s{2,}/g, " ").trim()
  }

  if (!rest) return null
  return { title: rest, isCompleted, priority, dueDate, estimateMinutes }
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

export const AI_PROMPT_TEMPLATE = `You are a strict TEXT-TO-FORMAT CONVERTER for an app called FlowSpace.

TASK: turn my notes into FlowSpace "import format" — a precise plain-text layout shown below. Copy the shape EXACTLY, character for character, especially the brackets. Output ONLY the converted text. Do NOT add a greeting, do NOT explain, and do NOT wrap it in code fences or quotes.

──────────── TEMPLATE (copy this exact shape) ────────────
# Project: PUT THE TITLE HERE
Status: active
Due: 2026-12-31
Tags: tag-one, tag-two

## Tasks
- [ ] A normal task to do
- [ ] (high) ~2h An important task with a 2-hour estimate
- [ ] @2026-07-15 A task that has a deadline
- [ ] A task that has subtasks and a checklist
  - [ ] A subtask (indented 2 spaces under its task)
  - [x] A finished subtask
  Checklist: Pre-flight
  - [ ] A checklist item
  - [x] A finished checklist item
- [x] A task that is already finished

## Notes
Any extra detail, written as plain sentences.

──────────── RULES (follow every single one) ────────────
1) THE FIRST LINE is the title line. It must be, in this exact order:
   one "#"  +  one space  +  the Type  +  a colon ":"  +  one space  +  the title.
   Correct example:  # Project: Website Relaunch
   The Type must be EXACTLY one of these six words:
   Project   Page   Todo   Canvas   Reminder   Process
   If you are not sure which to use, use Project.

2) SECTION HEADINGS start with TWO hashes. There are only two:
   "## Tasks"   (the list of things to do)
   "## Notes"   (extra description text)
   Write them exactly like that, capital T and capital N.

3) EVERY task line MUST begin with these six characters:  - [ ]
   (a dash, a space, an open square bracket, a SPACE, a close square bracket, a space)
   - [ ] like this   = a task that is NOT done (empty box)
   - [x] like this   = a task that IS done (a lowercase x inside the box)
   DO NOT write a task as "- task" or "* task" or "1. task". It MUST have the [ ] or [x] box.

4) PRIORITY is optional. To add it, put one word in ROUND brackets right after the box.
   The ONLY allowed words are: urgent, high, medium, low.
   Example:  - [ ] (high) Title
   If a task has no priority, leave it out — never write "(none)".

5) DUE DATE is optional. To add it, write "@" then the date as YYYY-MM-DD
   (4-digit year, dash, 2-digit month, dash, 2-digit day). No other date style.
   Example:  - [ ] @2026-08-01 Title
   You may use BOTH a priority and a date on one task, in any order:
   - [ ] (high) @2026-08-01 Title

6) ESTIMATE is optional. Add a "~" token with a duration: ~30m, ~2h, or ~1h30m.
   Example:  - [ ] ~45m Title

7) SUBTASKS are optional. Indent a task line by TWO spaces under its parent task.
   - [ ] Parent task
     - [ ] A subtask
     - [x] A finished subtask

8) CHECKLISTS are optional. Under a task, add an indented line "Checklist: <name>",
   then indented "- [ ]" lines as its items. Put any subtasks BEFORE the Checklist line.
   - [ ] A task
     Checklist: QA steps
     - [ ] Run tests
     - [x] Smoke test

9) THE TOP LINES (Status, Due, Tags) are optional and only for "# Project:". Put each on its own line directly under line 1:
   Status:  one of  planning  active  paused  completed
   Due:     YYYY-MM-DD
   Tags:    comma, separated, lowercase
   Leave out any line you do not need.

10) Lines under "## Notes" are plain sentences. Do NOT put "- [ ]" boxes there.

11) Output ONE element ONLY — there must be exactly ONE line that starts with "#" at the very top. Never output two "#" headers.

──────────── A FULL CORRECT EXAMPLE ────────────
# Project: Website Relaunch
Status: active
Due: 2026-09-01
Tags: web, marketing

## Tasks
- [ ] (urgent) @2026-07-01 Lock the brief with stakeholders
- [ ] (high) ~6h Design the homepage
  - [ ] Hero section
  - [ ] Footer
  Checklist: Design review
  - [ ] Mobile layout checked
  - [x] Brand colours applied
- [ ] @2026-07-15 Build the components
- [x] Kickoff meeting

## Notes
Relaunch before Q4. Keep the old URLs redirecting.

──────────── CHECK BEFORE YOU ANSWER ────────────
- Line 1 starts with "# " and one of the six Types.
- Every task line starts with "- [ ] " or "- [x] ".
- Priorities are only urgent/high/medium/low, inside (round brackets).
- Dates look exactly like @2026-07-15; estimates like ~30m / ~2h / ~1h30m.
- Subtasks and checklist items are indented 2 spaces under their task.
- There are no code fences and no extra words — only the format above.

Now convert my notes into that format. If we already discussed the work above, use that. My notes:`

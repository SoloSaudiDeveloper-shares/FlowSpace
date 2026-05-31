"use server"

/**
 * Drop a file → land it as a Page.
 *
 * Supported types:
 *   - PDF (.pdf)            extracted to plain text via unpdf (Node-safe pdf.js)
 *   - Word (.docx)          extracted to plain text via mammoth
 *   - Excel (.xlsx)         parsed via exceljs, each sheet → a markdown table
 *   - CSV / TSV (.csv/.tsv) parsed via papaparse, rendered as a
 *                           markdown table inside the page
 *   - Plain text (.txt/.md) ingested as-is
 *
 * The new Page is created in the user's workspace, opened by the
 * client via a redirect. Optional `summarize:true` runs the result
 * through the user's AI provider for a short summary appended at the
 * top of the page body.
 *
 * Files are base64-encoded on the client and decoded here. Limits:
 *  - max 10 MB raw upload (server enforces; client should pre-check)
 *  - PDF: first 500 pages parsed (pdf-parse has its own internal cap)
 *  - CSV: 50_000 rows, 50 columns (truncated with a notice)
 */

import { requireAuth } from "@/lib/auth/scope"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { revalidatePath } from "next/cache"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_CSV_ROWS = 50_000
const MAX_CSV_COLS = 50

export type IngestKind = "pdf" | "docx" | "xlsx" | "csv" | "tsv" | "text" | "unknown"

function detectKind(filename: string, mime?: string): IngestKind {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf"
  if (
    lower.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx"
  if (
    lower.endsWith(".xlsx") ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "xlsx"
  if (lower.endsWith(".csv") || mime === "text/csv") return "csv"
  if (lower.endsWith(".tsv") || mime === "text/tab-separated-values") return "tsv"
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    mime === "text/plain" ||
    mime === "text/markdown"
  )
    return "text"
  return "unknown"
}

interface IngestResult {
  /** Plain text representation (used for the Page body + optional summary). */
  text: string
  /** A friendly one-line summary of what we extracted (e.g. "12 pages, 8451 words"). */
  summary: string
  kind: IngestKind
}

async function extractPdf(buf: Buffer): Promise<IngestResult> {
  // unpdf ships a serverless/Node build of pdf.js that doesn't touch
  // browser globals like DOMMatrix (the old pdf-parse path threw
  // "DOMMatrix is not defined" in Node). Text-only, no canvas needed.
  const { extractText, getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim()
  const words = merged.split(/\s+/).filter(Boolean).length
  return {
    text: merged,
    kind: "pdf",
    summary: `${totalPages} page${totalPages === 1 ? "" : "s"} · ${words.toLocaleString()} words`,
  }
}

async function extractDocx(buf: Buffer): Promise<IngestResult> {
  // mammoth converts .docx → plain text in pure JS (no native deps).
  const mod = await import("mammoth")
  const mammoth = (mod as { default?: typeof import("mammoth") }).default ?? mod
  const result = await mammoth.extractRawText({ buffer: buf })
  const text = (result.value ?? "").trim()
  const words = text.split(/\s+/).filter(Boolean).length
  return {
    text,
    kind: "docx",
    summary: `${words.toLocaleString()} word${words === 1 ? "" : "s"}`,
  }
}

async function extractDelimited(
  buf: Buffer,
  kind: "csv" | "tsv",
): Promise<IngestResult> {
  const mod = await import("papaparse")
  const Papa = (mod.default ?? mod) as typeof import("papaparse")
  const raw = buf.toString("utf8")
  const result = Papa.parse<string[]>(raw, {
    delimiter: kind === "tsv" ? "\t" : ",",
    skipEmptyLines: true,
  })
  const rows = result.data
  const rowCount = rows.length
  const colCount = rows[0]?.length ?? 0
  const truncated = rowCount > MAX_CSV_ROWS || colCount > MAX_CSV_COLS
  const visibleRows = rows.slice(0, MAX_CSV_ROWS).map((r) => r.slice(0, MAX_CSV_COLS))
  // Render as a markdown table. First row treated as header. We escape
  // pipes in cell content so the table doesn't break.
  const esc = (s: string) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")
  let table = ""
  if (visibleRows.length > 0) {
    const [header, ...body] = visibleRows
    table += `| ${header.map(esc).join(" | ")} |\n`
    table += `| ${header.map(() => "---").join(" | ")} |\n`
    for (const row of body) {
      table += `| ${row.map(esc).join(" | ")} |\n`
    }
  }
  return {
    text: truncated
      ? `${table}\n\n_Truncated for display: ${rowCount.toLocaleString()} rows × ${colCount} cols → showing first ${Math.min(MAX_CSV_ROWS, rowCount).toLocaleString()} × ${Math.min(MAX_CSV_COLS, colCount)}._`
      : table,
    kind,
    summary: `${rowCount.toLocaleString()} row${rowCount === 1 ? "" : "s"} · ${colCount} column${colCount === 1 ? "" : "s"}`,
  }
}

/** Coerce any exceljs cell value (rich text, hyperlink, formula, date…) to a flat string. */
function cellToString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") {
    const v = value as Record<string, unknown>
    // Rich text: array of styled runs.
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((t) => t.text ?? "").join("")
    }
    // Hyperlink cell: { text, hyperlink }.
    if (typeof v.hyperlink === "string") {
      return typeof v.text === "string" ? v.text : v.hyperlink
    }
    // Formula cell: { formula, result } — show the computed result.
    if ("result" in v) return cellToString(v.result)
    // Plain/shared text shape.
    if (typeof v.text === "string") return v.text
  }
  return String(value)
}

async function extractXlsx(buf: Buffer): Promise<IngestResult> {
  // exceljs (already a dep) reads .xlsx in pure JS. We render each sheet as
  // its own markdown table under a "### <sheet name>" heading.
  const mod = await import("exceljs")
  const ExcelJS = (mod as { default?: typeof import("exceljs") }).default ?? mod
  const wb = new ExcelJS.Workbook()
  // exceljs's bundled types pin an older non-generic Buffer; the runtime
  // accepts a Node Buffer fine, so cast to the declared parameter type.
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0])
  const esc = (s: string) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")
  let out = ""
  let totalRows = 0
  let sheetCount = 0
  wb.eachSheet((ws) => {
    sheetCount++
    const rows: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= MAX_CSV_ROWS) return
      // row.values is 1-indexed (index 0 is null); drop it.
      const raw = Array.isArray(row.values) ? row.values.slice(1) : []
      const values: string[] = []
      for (let i = 0; i < Math.min(raw.length, MAX_CSV_COLS); i++) {
        values.push(cellToString(raw[i]))
      }
      rows.push(values)
    })
    if (rows.length === 0) return
    totalRows += rows.length
    // Normalise ragged rows to the widest row so the table stays valid.
    const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0)
    const norm = rows.map((r) => {
      const c = r.slice()
      while (c.length < colCount) c.push("")
      return c
    })
    out += `### ${esc(ws.name)}\n\n`
    const [header, ...body] = norm
    out += `| ${header.map(esc).join(" | ")} |\n`
    out += `| ${header.map(() => "---").join(" | ")} |\n`
    for (const r of body) {
      out += `| ${r.map(esc).join(" | ")} |\n`
    }
    out += "\n"
  })
  return {
    text: out.trim(),
    kind: "xlsx",
    summary: `${sheetCount} sheet${sheetCount === 1 ? "" : "s"} · ${totalRows.toLocaleString()} row${totalRows === 1 ? "" : "s"}`,
  }
}

function extractText(buf: Buffer): IngestResult {
  const text = buf.toString("utf8")
  const lines = text.split("\n").length
  return {
    text: text.trim(),
    kind: "text",
    summary: `${lines.toLocaleString()} line${lines === 1 ? "" : "s"}`,
  }
}

interface IngestInput {
  filename: string
  /** Raw bytes as base64. The client converts the file with FileReader. */
  base64: string
  mime?: string
  /** When true, ask the user's AI to summarise the extracted text in
   *  3-5 bullets and prepend it to the page body. */
  summarize?: boolean
}

export async function ingestFileAsPage(
  input: IngestInput,
): Promise<
  | { ok: true; pageId: string; kind: IngestKind; warning?: string }
  | { ok: false; error: string }
> {
  const me = await requireAuth()
  // Decode + size check
  let buf: Buffer
  try {
    buf = Buffer.from(input.base64, "base64")
  } catch {
    return { ok: false, error: "Couldn't decode the file payload." }
  }
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: `Too big (max ${MAX_BYTES / 1024 / 1024} MB).` }
  }
  const kind = detectKind(input.filename, input.mime)
  if (kind === "unknown") {
    return { ok: false, error: "Unsupported file type. Try PDF, Word (.docx), Excel (.xlsx), CSV, TSV, TXT, or MD." }
  }

  let extracted: IngestResult
  try {
    if (kind === "pdf") extracted = await extractPdf(buf)
    else if (kind === "docx") extracted = await extractDocx(buf)
    else if (kind === "xlsx") extracted = await extractXlsx(buf)
    else if (kind === "csv" || kind === "tsv") extracted = await extractDelimited(buf, kind)
    else extracted = extractText(buf)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `Couldn't parse: ${err.message}` : "Couldn't parse file.",
    }
  }

  // Optional summary via the user's AI provider
  let header = `**Source:** \`${input.filename}\` · ${extracted.summary}\n\n`
  let warning: string | undefined
  if (input.summarize) {
    if (extracted.text.length <= 200) {
      warning = "Too short to summarise — imported without an AI summary."
    } else {
      const r = await summarizeWithAI(me.id, extracted.text)
      if (r.ok) {
        header += `**Summary**\n\n${r.summary}\n\n---\n\n`
      } else if (r.reason === "no_provider") {
        warning = "AI summary skipped — no AI provider is set up yet (Settings → AI)."
      } else {
        warning = "AI summary failed — imported without it. Check your AI provider in Settings."
      }
    }
  }

  const body = header + extracted.text
  // Create the Page. BlockNote can render markdown-style content in
  // a paragraph block; for a quick MVP we drop the full text inside
  // one paragraph block.
  const pageId = createId()
  const content = JSON.stringify([
    {
      id: createId(),
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: body, styles: {} }],
      children: [],
    },
  ])
  try {
    sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO elements (id, type, title, icon, color, created_by)
           VALUES (?, 'page', ?, 'FileText', '#a78bfa', ?)`,
        )
        .run(pageId, input.filename.replace(/\.[^.]+$/, "").slice(0, 200), me.id)
      sqlite
        .prepare(`INSERT INTO pages (id, content) VALUES (?, ?)`)
        .run(pageId, content)
    })()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." }
  }
  revalidatePath("/pages")
  return { ok: true, pageId, kind, warning }
}

type SummaryResult =
  | { ok: true; summary: string }
  | { ok: false; reason: "no_provider" | "request_failed" }

async function summarizeWithAI(
  userId: string,
  text: string,
): Promise<SummaryResult> {
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return { ok: false, reason: "no_provider" }
  let prefs: { aiOpenAIBaseUrl?: string; aiOpenAIApiKey?: string; aiOpenAIModel?: string }
  try {
    prefs = JSON.parse(row.prefs_json)
  } catch {
    return { ok: false, reason: "no_provider" }
  }
  if (!prefs.aiOpenAIBaseUrl || !prefs.aiOpenAIApiKey) return { ok: false, reason: "no_provider" }
  const baseUrl = prefs.aiOpenAIBaseUrl.replace(/\/+$/, "")
  const model = prefs.aiOpenAIModel?.trim() || "gpt-4o-mini"
  // Cap context to ~8k chars so we stay inside small-model windows.
  const excerpt = text.slice(0, 8000)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${prefs.aiOpenAIApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You summarise documents in 3-5 concise bullet points. Be specific about numbers, names, dates. No preamble.",
          },
          { role: "user", content: excerpt },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { ok: false, reason: "request_failed" }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const summary = data.choices?.[0]?.message?.content?.trim()
    return summary ? { ok: true, summary } : { ok: false, reason: "request_failed" }
  } catch {
    return { ok: false, reason: "request_failed" }
  }
}

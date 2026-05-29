"use server"

/**
 * Drop a file → land it as a Page.
 *
 * Supported types:
 *   - PDF (.pdf)            extracted to plain text via pdf-parse
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

export type IngestKind = "pdf" | "csv" | "tsv" | "text" | "unknown"

function detectKind(filename: string, mime?: string): IngestKind {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf"
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
  // pdf-parse v2 ships a class-based API. Wrap in a try so any throw
  // from PDF.js (corrupt file, encrypted, weird charset) lands as a
  // friendly "couldn't parse" instead of a 500.
  const { PDFParse } = await import("pdf-parse")
  // PDF.js prefers a Uint8Array view; passing a Buffer can trigger a
  // detached-buffer warning on some Node versions.
  const data = new Uint8Array(buf)
  const parser = new PDFParse({ data })
  const out = await parser.getText()
  const text = (out.text ?? "").trim()
  const words = text.split(/\s+/).filter(Boolean).length
  return {
    text,
    kind: "pdf",
    summary: `${out.total} page${out.total === 1 ? "" : "s"} · ${words.toLocaleString()} words`,
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
): Promise<{ ok: true; pageId: string; kind: IngestKind } | { ok: false; error: string }> {
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
    return { ok: false, error: "Unsupported file type. Try PDF, CSV, TSV, TXT, or MD." }
  }

  let extracted: IngestResult
  try {
    if (kind === "pdf") extracted = await extractPdf(buf)
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
  if (input.summarize && extracted.text.length > 200) {
    const summary = await summarizeWithAI(me.id, extracted.text)
    if (summary) {
      header += `**Summary**\n\n${summary}\n\n---\n\n`
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
  return { ok: true, pageId, kind }
}

async function summarizeWithAI(
  userId: string,
  text: string,
): Promise<string | null> {
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return null
  let prefs: { aiOpenAIBaseUrl?: string; aiOpenAIApiKey?: string; aiOpenAIModel?: string }
  try {
    prefs = JSON.parse(row.prefs_json)
  } catch {
    return null
  }
  if (!prefs.aiOpenAIBaseUrl || !prefs.aiOpenAIApiKey) return null
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
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

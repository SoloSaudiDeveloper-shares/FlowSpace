"use server"

/**
 * Export a todo list as an Excel (.xlsx) file.
 *
 * Two flavours:
 *   - `getTodoListXlsx(listId)` returns the binary buffer + filename
 *     so the client can trigger a download. Used by the "Export" button
 *     in the todo list header.
 *   - `emailTodoListXlsx(listId, to)` sends the xlsx as an attachment
 *     through the existing email transport. Subject = list title;
 *     body = "Here's your list", attachment = the file.
 *
 * Permission: caller must own the list. We never let one user export
 * another user's list.
 *
 * Style: header row with bold + dark fill + white font, alternating
 * row stripes, frozen header, autofilter, completed items struck
 * through with grey font. Matches the Excel-skill spec.
 */

import ExcelJS from "exceljs"
import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { sendEmail, isEmailConfigured } from "@/lib/email/send"
import { escapeHtml } from "@/lib/utils"

export interface TodoListExportResult {
  ok: true
  /** base64-encoded xlsx for transit to the browser */
  base64: string
  filename: string
}

interface OwnedList {
  id: string
  title: string
  description: string | null
}

function ownedList(userId: string, listId: string): OwnedList | null {
  return sqlite
    .prepare(
      `SELECT id, title, description FROM elements
        WHERE id = ? AND created_by = ?
          AND type = 'todo_list' AND is_deleted = 0`,
    )
    .get(listId, userId) as OwnedList | null
}

interface ItemRow {
  title: string
  notes: string | null
  isCompleted: number
  dueDate: string | null
  createdAt: string
  completedAt: string | null
  sortOrder: number
}

function itemsFor(listId: string): ItemRow[] {
  return sqlite
    .prepare(
      `SELECT title, notes, is_completed AS isCompleted,
              due_date AS dueDate, created_at AS createdAt,
              completed_at AS completedAt, sort_order AS sortOrder
         FROM todo_items
        WHERE list_id = ?
        ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(listId) as ItemRow[]
}

async function buildWorkbook(list: OwnedList, items: ItemRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "FlowSpace"
  wb.created = new Date()

  const ws = wb.addWorksheet(list.title.slice(0, 30) || "Todo list")

  // Title block above the table
  ws.mergeCells("A1:E1")
  const titleCell = ws.getCell("A1")
  titleCell.value = list.title
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF1E293B" } }
  titleCell.alignment = { vertical: "middle" }
  ws.getRow(1).height = 26

  if (list.description) {
    ws.mergeCells("A2:E2")
    const desc = ws.getCell("A2")
    desc.value = list.description
    desc.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF64748B" } }
    desc.alignment = { wrapText: true, vertical: "top" }
  }

  const headerRowIdx = 4
  const headers = ["#", "Item", "Done", "Due", "Notes"]
  const header = ws.getRow(headerRowIdx)
  header.values = headers
  header.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  }
  header.alignment = { horizontal: "center", vertical: "middle" }
  header.height = 22

  items.forEach((it, i) => {
    const row = ws.getRow(headerRowIdx + 1 + i)
    row.values = [
      i + 1,
      it.title,
      it.isCompleted ? "✓" : "",
      it.dueDate ? new Date(it.dueDate) : "",
      it.notes ?? "",
    ]
    row.font = { name: "Arial", size: 10 }
    row.alignment = { vertical: "top", wrapText: true }
    if (i % 2 === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      }
    }
    if (it.isCompleted) {
      row.font = {
        name: "Arial",
        size: 10,
        strike: true,
        color: { argb: "FF94A3B8" },
      }
    }
    // Date cell formatting
    const dueCell = row.getCell(4)
    if (dueCell.value instanceof Date) {
      dueCell.numFmt = "yyyy-mm-dd"
      dueCell.alignment = { horizontal: "center", vertical: "top" }
    }
    const doneCell = row.getCell(3)
    doneCell.alignment = { horizontal: "center", vertical: "top" }
    if (it.isCompleted) {
      doneCell.font = { name: "Arial", size: 10, color: { argb: "FF22C55E" }, bold: true }
    }
  })

  ws.columns = [
    { width: 5 },
    { width: 50 },
    { width: 8 },
    { width: 14 },
    { width: 40 },
  ]
  // Freeze the title + header rows; autofilter on the data block
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }]
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx + items.length, column: headers.length },
  }
  // Summary row underneath — counts as formulas so the file stays live
  const summaryRow = headerRowIdx + items.length + 2
  ws.getCell(`A${summaryRow}`).value = "Total"
  ws.getCell(`B${summaryRow}`).value = items.length
  ws.getCell(`A${summaryRow + 1}`).value = "Completed"
  ws.getCell(`B${summaryRow + 1}`).value = {
    formula: `COUNTIF(C${headerRowIdx + 1}:C${headerRowIdx + items.length},"✓")`,
  }
  ws.getCell(`A${summaryRow + 2}`).value = "Open"
  ws.getCell(`B${summaryRow + 2}`).value = {
    formula: `B${summaryRow}-B${summaryRow + 1}`,
  }
  for (const r of [summaryRow, summaryRow + 1, summaryRow + 2]) {
    ws.getCell(`A${r}`).font = { name: "Arial", size: 10, bold: true }
    ws.getCell(`B${r}`).font = { name: "Arial", size: 10 }
    ws.getCell(`B${r}`).alignment = { horizontal: "right" }
  }

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

function safeFilename(title: string): string {
  const cleaned = title.replace(/[^a-z0-9\-_ ]/gi, "_").trim() || "todo-list"
  const date = new Date().toISOString().slice(0, 10)
  return `${cleaned} — ${date}.xlsx`
}

export async function getTodoListXlsx(
  listId: string,
): Promise<TodoListExportResult | { ok: false; error: string }> {
  const me = await requireAuth()
  const list = ownedList(me.id, listId)
  if (!list) return { ok: false, error: "Todo list not found." }
  const items = itemsFor(listId)
  const buf = await buildWorkbook(list, items)
  return {
    ok: true,
    base64: buf.toString("base64"),
    filename: safeFilename(list.title),
  }
}

export async function emailTodoListXlsx(
  listId: string,
  to: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: "That doesn't look like a valid email address." }
  }
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email is not configured on the server." }
  }
  const me = await requireAuth()
  const list = ownedList(me.id, listId)
  if (!list) return { ok: false, error: "Todo list not found." }
  const items = itemsFor(listId)
  const buf = await buildWorkbook(list, items)
  const filename = safeFilename(list.title)
  const subject = `${list.title} — list export`
  const html = `
    <p>Hi,</p>
    <p>Here's the <strong>${escapeHtml(list.title)}</strong> list as a spreadsheet (${items.length} items).
       The file is attached.</p>
    <p style="color:#64748b;font-size:12px;">Sent from FlowSpace.</p>
  `
  const result = await sendEmail({
    to,
    subject,
    html,
    text: `${list.title} — ${items.length} items. See attached spreadsheet.`,
    attachments: [
      {
        filename,
        content: buf,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  })
  return result.ok ? { ok: true } : result
}

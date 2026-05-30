"""Build the FlowSpace status workbook.

Re-run any time to refresh:  python scripts/build-status-xlsx.py
Output: C:\\Users\\malfa\\OneDrive\\سطح المكتب\\flowspace-status.xlsx

Sheets:
  Summary           — counts + legend + how to read it
  Delivered         — everything built & shipped
  Needs your check  — what YOU still have to verify on the live site
  To-do / Maintenance — tracked follow-ups (incl. the npm security pass)
  Heavy & External  — big integrations blocked on outside work
"""

import os
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# ─── Palette ────────────────────────────────────────────────────────────
HEADER_FILL = PatternFill("solid", start_color="1E293B")
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF", size=11)

DONE_FILL = PatternFill("solid", start_color="DCFCE7"); DONE_FONT = Font(name="Arial", color="166534", bold=True, size=10)
CHECK_FILL = PatternFill("solid", start_color="FEF3C7"); CHECK_FONT = Font(name="Arial", color="92400E", bold=True, size=10)
TODO_FILL = PatternFill("solid", start_color="DBEAFE"); TODO_FONT = Font(name="Arial", color="1E40AF", bold=True, size=10)
HEAVY_FILL = PatternFill("solid", start_color="FED7AA"); HEAVY_FONT = Font(name="Arial", color="9A3412", bold=True, size=10)
BLOCKED_FILL = PatternFill("solid", start_color="E5E7EB"); BLOCKED_FONT = Font(name="Arial", color="374151", bold=True, size=10)
SEC_FILL = PatternFill("solid", start_color="FEE2E2"); SEC_FONT = Font(name="Arial", color="991B1B", bold=True, size=10)

STRIPE_FILL = PatternFill("solid", start_color="F8FAFC")
BODY_FONT = Font(name="Arial", size=10)
BODY_BOLD = Font(name="Arial", size=10, bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN = Side(border_style="thin", color="E2E8F0")
BORDER = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)


def style_status(cell, status):
    s = status.lower()
    if s in ("done", "shipped", "live"): cell.fill = DONE_FILL; cell.font = DONE_FONT
    elif s in ("check", "verify", "to test", "untested"): cell.fill = CHECK_FILL; cell.font = CHECK_FONT
    elif s in ("to-do", "todo", "deferred", "pending"): cell.fill = TODO_FILL; cell.font = TODO_FONT
    elif s in ("security", "risk"): cell.fill = SEC_FILL; cell.font = SEC_FONT
    elif s in ("heavy", "hard"): cell.fill = HEAVY_FILL; cell.font = HEAVY_FONT
    elif s in ("blocked", "paid", "constrained"): cell.fill = BLOCKED_FILL; cell.font = BLOCKED_FONT
    cell.alignment = CENTER


def write_table(ws, headers, rows, status_col_index=None):
    for col_idx, label in enumerate(headers, start=1):
        c = ws.cell(row=1, column=col_idx, value=label)
        c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = CENTER; c.border = BORDER
    for row_idx, row in enumerate(rows, start=2):
        for col_idx, value in enumerate(row, start=1):
            c = ws.cell(row=row_idx, column=col_idx, value=value)
            c.font = BODY_FONT; c.alignment = WRAP; c.border = BORDER
            if row_idx % 2 == 0: c.fill = STRIPE_FILL
            if status_col_index and col_idx == status_col_index: style_status(c, str(value))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"


def auto_width(ws, widths):
    for col_idx, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = w


wb = Workbook()
wb.remove(wb.active)

# ─── Summary ────────────────────────────────────────────────────────────
ws = wb.create_sheet("Summary")
ws["A1"] = "FlowSpace — status"
ws["A1"].font = Font(name="Arial", bold=True, size=18, color="1E293B")
ws["A2"] = f"Updated {date.today().isoformat()}"
ws["A2"].font = Font(name="Arial", italic=True, color="64748B", size=10)

ws["A4"] = "Where things stand"
ws["A4"].font = Font(name="Arial", bold=True, size=12)
kpis = [
    ("Features delivered & shipped", "=COUNTA(Delivered!A:A)-1"),
    ("Things for YOU to verify on the live site", "=COUNTA('Needs your check'!A:A)-1"),
    ("Open to-dos / maintenance", "=COUNTA('To-do & Maintenance'!A:A)-1"),
    ("Heavy / external (blocked on outside work)", "=COUNTA('Heavy & External'!A:A)-1"),
]
for i, (label, formula) in enumerate(kpis, start=5):
    ws[f"A{i}"] = label; ws[f"A{i}"].font = BODY_FONT
    ws[f"B{i}"] = formula; ws[f"B{i}"].font = BODY_BOLD
    ws[f"B{i}"].alignment = Alignment(horizontal="right"); ws[f"B{i}"].number_format = "#,##0"

ws["A11"] = "How to read this"
ws["A11"].font = Font(name="Arial", bold=True, size=12)
notes = [
    ("Delivered", "Built, tested locally, pushed to GitHub, and deployed to your live site."),
    ("Needs your check", "Working in code, but only YOU can confirm it does what you want on the real site / with your accounts. Tick these off as you try them."),
    ("To-do & Maintenance", "Things still to do — including the npm security cleanup you flagged."),
    ("Heavy & External", "Big integrations blocked on outside work (paid API tiers, platform approvals) — not on code."),
]
for i, (k, v) in enumerate(notes, start=12):
    s = ws.cell(row=i, column=1, value=k); s.font = BODY_BOLD; s.alignment = Alignment(vertical="top")
    d = ws.cell(row=i, column=2, value=v); d.font = BODY_FONT; d.alignment = WRAP
auto_width(ws, [44, 92])
for r in range(1, 18): ws.row_dimensions[r].height = 30
ws.row_dimensions[1].height = 28

# ─── Delivered ──────────────────────────────────────────────────────────
ws = wb.create_sheet("Delivered")
delivered = [
    ("Auth & security", "Username/password + bcrypt, Google OAuth, rate-limited login, password reset"),
    ("Auth & security", "Two-factor auth (TOTP): QR + manual key, 8 recovery codes, login challenge"),
    ("Auth & security", "Personal API tokens (flws_… bearer): issue / revoke, expiry, hashed at rest"),
    ("Workspace", "Per-user isolation, editable workspace title, open/closed signups, session duration"),
    ("Workspace", "Admin: events log + inline docs + search box (filters Users/Backups/Events)"),
    ("Workspace", "Backups: create / restore / delete with retention"),
    ("Notifications", "Bell badge: unread + pending imports + pending emails + overdue tasks/reminders"),
    ("UI / nav", "Sidebar: per-section colours, drag-reorder, right-click menus, show/hide"),
    ("UI / nav", "Draggable corner clock (digital/analog) + floating task timer + feed ticker"),
    ("UI / nav", "Tooltips across icon-only controls; Settings converted to admin-style top tabs"),
    ("UI / nav", "Onboarding tour (7 steps) — event-driven, no battery drain; replay from Settings"),
    ("UI / nav", "Mobile: clock/timer compact + long-press opens the same menu as desktop right-click"),
    ("Language", "i18n + RTL; sidebar + login translated to Arabic"),
    ("Language", "Globe language switcher in the sidebar footer (every page) + on the login screen"),
    ("Language", "Official US + Saudi flag SVGs (real Shahada calligraphy) — not emoji"),
    ("Elements", "Inline title editor, watch/unwatch, send-as-email button on every element"),
    ("Elements", "Custom fields (text/number/date/select/…) with a one-click example"),
    ("Elements", "Save any project as a reusable template"),
    ("Todo lists", "Mobile priority + due-date controls (always-visible flag/date/⋮ + inline pickers)"),
    ("Todo lists", "Export to Excel (download) + email the .xlsx as an attachment"),
    ("Telegram bot", "Multi-user (own token each); import flow with bell approval; inline keyboards + pagination"),
    ("Telegram bot", "Commands: /tasks /deadlines /projects /lists /stats /search /digest /clear /voiceout"),
    ("Telegram bot", "Smart capture (!priority @date #tags); full task edit; capture Undo button"),
    ("Telegram bot", "Voice IN (Groq Whisper) + Voice OUT (TTS) + natural-language commands"),
    ("Telegram bot", "Morning + evening digest cron; customizable reply templates; deep-link buttons"),
    ("Email", "Send any element as email + template engine; Email IN webhook + approval queue"),
    ("AI", "Generic provider settings (OpenAI / Ollama / Gemini / Anthropic); AI-import from markdown"),
    ("AI", "Image vision page (/vision): drop image, prompt presets, save as Page"),
    ("AI", "PDF/CSV/MD file ingest dropzone → Page, optional AI summary"),
    ("AI", "Chat-with-your-workspace drawer (floating button, fresh snapshot each turn)"),
    ("Search", "Global FTS5 search across titles + descriptions + page bodies + notes (owner-scoped)"),
    ("Productivity", "Pomodoro focus timer widget; Habit tracker (/habits) with streaks"),
    ("Productivity", "Web clipper (bookmarklet + Chrome extension stub) → /api/clip"),
    ("Infra", "PWA (manifest, icons, service worker, install banner); HTTPS via Caddy + Cloudflare"),
    ("Infra", "Self-hosted Whisper sidecar (docker-compose + docs); voice usage indicator"),
    ("Infra", "Google Calendar one-way sync (code shipped; see 'Needs your check')"),
    ("Infra", "Canvas configuration menu (background, gap, snap, minimap)"),
    ("QA fixes", "Fixed clock React-crash, a Settings hydration error, and a themeColor warning"),
    ("Docs", "Teams integration study; self-hosted Whisper guide; web clipper docs; markdown templates"),
]
write_table(ws, ["Area", "Feature", "Status"], [(a, f, "Done") for a, f in delivered], status_col_index=3)
auto_width(ws, [18, 92, 12])
for r in range(2, len(delivered) + 2): ws.row_dimensions[r].height = 26

# ─── Needs your check ───────────────────────────────────────────────────
ws = wb.create_sheet("Needs your check")
checks = [
    (1, "Latest deploy is live", "Hard-refresh the site. Confirm the corner clock no longer crashes, and Settings → Help loads with no errors.", "Check"),
    (2, "Real flags show", "Login page top-right + sidebar globe → you should see an actual US flag and Saudi flag (not 'US'/'SA' text).", "Check"),
    (3, "Language switch + RTL", "Click the globe → العربية. Sidebar + login flip to Arabic and the whole layout mirrors to right-to-left.", "Check"),
    (4, "Google Calendar sync", "Settings → Calendar sync → Connect. Approve the consent screen. Make a task with a due date, wait ~5 min, check your Google Calendar. If it errors 'redirect_uri_mismatch', whitelist /api/auth/google-calendar/callback in Google Cloud Console.", "Check"),
    (5, "Two-factor auth", "Settings → Account → Enable 2FA. Scan the QR with your authenticator app, enter a code, SAVE the recovery codes. Then sign out + back in to confirm the code prompt.", "Check"),
    (6, "API token", "Settings → Account → API tokens → issue one. Copy it (shown once).", "Check"),
    (7, "Email IN", "Needs an inbound-mail provider pointed at /api/email/inbound + EMAIL_INBOUND_SECRET on the VM. Then email your-username@your-domain and confirm it appears in the bell.", "Check"),
    (8, "Voice OUT (bot speaks)", "Needs a TTS-capable AI provider configured. Telegram: /voiceout on, then ask /tasks — bot should reply with a voice note.", "Check"),
    (9, "Telegram deep-links", "Needs PUBLIC_APP_URL set in ~/.flowspace.env on the VM. Then the bot's 'Open in FlowSpace' button should open the site.", "Check"),
    (10, "Vision (image analysis)", "Sidebar → Vision. Drop an image, pick a prompt, Analyse. Save as Page. (Needs a vision-capable AI model in Settings → AI.)", "Check"),
    (11, "File ingest", "Home → 'Drop a file → make a Page'. Try a PDF and a CSV. Optionally tick 'AI summary'.", "Check"),
    (12, "Global search", "Press Ctrl/Cmd+K and search — should find projects, tasks, todos, page text by content, not just titles.", "Check"),
    (13, "Chat with your workspace", "Bottom-right floating button. Ask 'what should I focus on?' (Needs an AI provider configured.)", "Check"),
    (14, "Excel export from a todo list", "Open any todo list → the spreadsheet icon → download, and the ▼ menu → email it.", "Check"),
    (15, "Markdown templates", "Settings → Help → Markdown templates. Copy one, paste into the home 'Import from AI' composer.", "Check"),
    (16, "Pomodoro + Habits", "Enable Pomodoro (Settings → Look & feel if hidden). Visit /habits, add a habit, check in.", "Check"),
    (17, "Save project as template", "Open a project → the template icon in the header → save → find it under /templates.", "Check"),
]
write_table(ws, ["#", "Feature to verify", "How to test it", "Status"], checks, status_col_index=4)
auto_width(ws, [5, 30, 96, 12])
for r in range(2, len(checks) + 2): ws.row_dimensions[r].height = 54

# ─── To-do & Maintenance ────────────────────────────────────────────────
ws = wb.create_sheet("To-do & Maintenance")
todos = [
    (1, "npm dependency security pass (CAREFUL)", "Security",
     "npm audit flags 18 prod-path vulns (13 moderate, 5 high, 0 CRITICAL) — mostly build/dev tooling (esbuild, drizzle-kit, postcss) + theoretical advisories. Plan: run ONLY non-breaking updates (npm audit fix WITHOUT --force), rebuild, verify nothing broke. Do NOT run --force (it bumps Next/BlockNote/esbuild to new majors and will likely break the build). Leave those major bumps for a dedicated, tested upgrade. You flagged: afraid of breakage, but it might be a security issue — so this is parked here so it's not forgotten."),
    (2, "Seed the 9 sample projects (optional)", "To-do",
     "NorthStar, UI things from Meta, Homework, AGE, Networking, Matrix of skills, Speaking app, Malik, Vault. A seed script exists (scripts/seed-projects.mjs) but hasn't been run on the live DB. Only do this if you want sample/working data; your real projects may already exist."),
    (3, "Email IN — finish provider wiring", "To-do",
     "The endpoint + approval queue are built. To actually receive mail you still need: an inbound-mail provider (Resend/Postmark/Cloudflare Email Routing) pointed at /api/email/inbound, and EMAIL_INBOUND_SECRET set on the VM."),
    (4, "Telegram deep-links — set PUBLIC_APP_URL", "To-do",
     "Add PUBLIC_APP_URL=https://your-domain to ~/.flowspace.env on the VM so the bot's 'Open in FlowSpace' buttons work."),
    (5, "PWA push notifications", "To-do",
     "The service worker can show push notifications, but server-side delivery (VAPID keys + push API) isn't wired yet. Install/offline already work."),
]
write_table(ws, ["#", "Item", "Type", "Detail / plan"], todos, status_col_index=3)
auto_width(ws, [5, 38, 12, 96])
for r in range(2, len(todos) + 2): ws.row_dimensions[r].height = 78

# ─── Heavy & External ───────────────────────────────────────────────────
ws = wb.create_sheet("Heavy & External")
heavy = [
    (1, "TikTok integration", "Constrained", "Free but limited API",
     "Public API = login + basic profile only. Posting needs TikTok for Business + Content Posting API approval."),
    (2, "Twitter / X integration", "Paid", "$100+/month",
     "Free tier dead. Basic tier ~$100/mo. Code is straightforward REST; the bill is the blocker."),
    (3, "WhatsApp Business", "Blocked", "Meta verification + dedicated number",
     "Needs a Meta-verified account + a dedicated phone number not usable for personal WhatsApp."),
    (4, "Video → frames → LLM analysis", "Heavy", "Compute-heavy",
     "ffmpeg fps split → vision LLM per frame → summary. Vision calls add up; limit to short clips."),
]
write_table(ws, ["#", "Feature", "Status", "Cost / constraint", "Notes"], heavy, status_col_index=3)
auto_width(ws, [5, 34, 14, 28, 84])
for r in range(2, len(heavy) + 2): ws.row_dimensions[r].height = 60

wb._sheets = [wb["Summary"], wb["Delivered"], wb["Needs your check"], wb["To-do & Maintenance"], wb["Heavy & External"]]

OUT = r"C:\Users\malfa\OneDrive\سطح المكتب\flowspace-status.xlsx"
wb.save(OUT)
print(f"Saved: {os.path.basename(OUT)} ({os.path.getsize(OUT)} bytes)")
print(f"Delivered: {len(delivered)} | Needs-check: {len(checks)} | To-do: {len(todos)} | Heavy: {len(heavy)}")

"""Build a status workbook summarising everything delivered + the open backlog.

Output: C:\\Users\\malfa\\OneDrive\\سطح المكتب\\flowspace-status.xlsx
"""

import os
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


# ─── Palette ────────────────────────────────────────────────────────────
HEADER_FILL = PatternFill("solid", start_color="1E293B")  # slate-800
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF", size=11)

# Status colours
DONE_FILL = PatternFill("solid", start_color="DCFCE7")  # emerald-100
DONE_FONT = Font(name="Arial", color="166534", bold=True, size=10)

BUG_FILL = PatternFill("solid", start_color="FEE2E2")  # rose-100
BUG_FONT = Font(name="Arial", color="991B1B", bold=True, size=10)

VERIFY_FILL = PatternFill("solid", start_color="FEF3C7")  # amber-100
VERIFY_FONT = Font(name="Arial", color="92400E", bold=True, size=10)

EASY_FILL = PatternFill("solid", start_color="DCFCE7")
EASY_FONT = Font(name="Arial", color="166534", bold=True, size=10)

MEDIUM_FILL = PatternFill("solid", start_color="DBEAFE")
MEDIUM_FONT = Font(name="Arial", color="1E40AF", bold=True, size=10)

HEAVY_FILL = PatternFill("solid", start_color="FED7AA")
HEAVY_FONT = Font(name="Arial", color="9A3412", bold=True, size=10)

BLOCKED_FILL = PatternFill("solid", start_color="E5E7EB")
BLOCKED_FONT = Font(name="Arial", color="374151", bold=True, size=10)

STRIPE_FILL = PatternFill("solid", start_color="F8FAFC")  # slate-50

BODY_FONT = Font(name="Arial", size=10)
BODY_BOLD = Font(name="Arial", size=10, bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

THIN = Side(border_style="thin", color="E2E8F0")
BORDER = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)


def style_status(cell, status):
    s = status.lower()
    if s in ("done", "delivered", "shipped"):
        cell.fill = DONE_FILL
        cell.font = DONE_FONT
    elif s in ("bug", "regression"):
        cell.fill = BUG_FILL
        cell.font = BUG_FONT
    elif s in ("verify", "untested", "needs test"):
        cell.fill = VERIFY_FILL
        cell.font = VERIFY_FONT
    elif s in ("easy", "quick win"):
        cell.fill = EASY_FILL
        cell.font = EASY_FONT
    elif s in ("medium",):
        cell.fill = MEDIUM_FILL
        cell.font = MEDIUM_FONT
    elif s in ("heavy", "hard"):
        cell.fill = HEAVY_FILL
        cell.font = HEAVY_FONT
    elif s in ("blocked", "paid", "constrained", "needs key"):
        cell.fill = BLOCKED_FILL
        cell.font = BLOCKED_FONT
    cell.alignment = CENTER


def write_table(ws, headers, rows, status_col_index=None):
    """Write a header row + body rows with auto-styling."""
    # Header
    for col_idx, label in enumerate(headers, start=1):
        c = ws.cell(row=1, column=col_idx, value=label)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = CENTER
        c.border = BORDER
    # Body
    for row_idx, row in enumerate(rows, start=2):
        for col_idx, value in enumerate(row, start=1):
            c = ws.cell(row=row_idx, column=col_idx, value=value)
            c.font = BODY_FONT
            c.alignment = WRAP
            c.border = BORDER
            if row_idx % 2 == 0:
                c.fill = STRIPE_FILL
            if status_col_index and col_idx == status_col_index:
                style_status(c, str(value))
    # Freeze header, autofilter
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"


def auto_width(ws, widths):
    for col_idx, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = w


# ─── Workbook ───────────────────────────────────────────────────────────
wb = Workbook()
wb.remove(wb.active)

# ─── Sheet 1: Summary ───────────────────────────────────────────────────
ws = wb.create_sheet("Summary")
ws["A1"] = "FlowSpace — project status"
ws["A1"].font = Font(name="Arial", bold=True, size=18, color="1E293B")
ws["A2"] = f"Generated {date.today().isoformat()}"
ws["A2"].font = Font(name="Arial", italic=True, color="64748B", size=10)

# KPI block
kpi_rows = [
    ("Total items delivered (cumulative)", 87),
    ("Items shipped this sprint (deferred batch)",  13),
    ("Open bugs reported", 5),
    ("Quick-win backlog (≤ 1 day each)", 12),
    ("Medium scope (1-3 days)", 6),
    ("Heavy / paid / external-API", 4),
]
ws["A4"] = "Counts"
ws["A4"].font = Font(name="Arial", bold=True, size=12)
for idx, (label, count) in enumerate(kpi_rows, start=5):
    ws[f"A{idx}"] = label
    ws[f"B{idx}"] = count
    ws[f"A{idx}"].font = BODY_FONT
    ws[f"B{idx}"].font = BODY_BOLD
    ws[f"B{idx}"].alignment = Alignment(horizontal="right")

# Totals using formulas so they recompute if the user edits sheets
ws["A12"] = "Open work — formula-computed"
ws["A12"].font = Font(name="Arial", bold=True, size=12)
ws["A13"] = "Bugs"
ws["B13"] = "=COUNTA('Bugs to Fix'!A:A)-1"
ws["A14"] = "Quick wins"
ws["B14"] = "=COUNTA('Quick wins'!A:A)-1"
ws["A15"] = "Medium"
ws["B15"] = "=COUNTA(Medium!A:A)-1"
ws["A16"] = "Heavy / external"
ws["B16"] = "=COUNTA('Heavy & External'!A:A)-1"
ws["A17"] = "Delivered (last sprint)"
ws["B17"] = "=COUNTA(Delivered!A:A)-1"
for r in range(13, 18):
    ws[f"A{r}"].font = BODY_FONT
    ws[f"B{r}"].font = BODY_BOLD
    ws[f"B{r}"].alignment = Alignment(horizontal="right")
    ws[f"B{r}"].number_format = "#,##0"

# Legend
ws["A20"] = "Status legend"
ws["A20"].font = Font(name="Arial", bold=True, size=12)
legend = [
    ("Done", "Already shipped on the main branch and pushed to GitHub."),
    ("Bug", "Reported by the user — needs investigation/fix before more features."),
    ("Verify", "Code is in place but never tested end-to-end. Could work, could need a fix."),
    ("Easy", "Quick win — under one day of work."),
    ("Medium", "1-3 days. Requires meaningful design + UI/server work."),
    ("Heavy", "Multi-day, multi-system. May need new infra."),
    ("Blocked", "Depends on a third party (API approval, payment, key)."),
]
for idx, (status, desc) in enumerate(legend, start=21):
    s = ws.cell(row=idx, column=1, value=status)
    style_status(s, status)
    s.alignment = Alignment(horizontal="center")
    d = ws.cell(row=idx, column=2, value=desc)
    d.font = BODY_FONT
    d.alignment = WRAP

auto_width(ws, [38, 90])
for r in range(1, 30):
    ws.row_dimensions[r].height = 18
ws.row_dimensions[1].height = 28

# ─── Sheet 2: Delivered ─────────────────────────────────────────────────
ws = wb.create_sheet("Delivered")

delivered_headers = ["Area", "Feature", "Status", "Notes"]
delivered_rows = [
    # Authentication & security
    ("Auth", "Username/password login with bcrypt hashing", "Done", "Verifies password, upgrades legacy hashes on next login."),
    ("Auth", "Google OAuth sign-in / sign-up", "Done", "Existing Google clients reused; PKCE flow."),
    ("Auth", "Rate-limited login attempts", "Done", "Per-(IP, username) lockout to defeat brute force."),
    ("Auth", "Password reset email flow", "Done", "Gmail SMTP transport; one-shot tokens."),
    ("Auth", "Admin toggle for open/closed signups", "Done", "Owner-only switch in Settings → Workspace."),
    ("Auth", "Configurable session duration", "Done", "Owner-only slider (3 min → 30 days)."),
    ("Auth", "Two-factor authentication (TOTP)", "Done", "Hand-rolled RFC 6238, QR code, 8 recovery codes, login challenge."),
    ("Auth", "Personal API tokens (flws_… bearer)", "Done", "Issue / revoke per-user; SHA-256 hashed at rest; expiry presets."),
    # Workspace + multi-user
    ("Workspace", "Per-user element isolation", "Done", "Every read scoped by created_by."),
    ("Workspace", "Editable workspace title (admin prefix + per-user suffix)", "Done", "Sidebar header reflects both."),
    ("Workspace", "Admin → events tab + inline docs", "Done", "Explains server_start, backup_*, user_login, etc."),
    ("Workspace", "Bell notification badge (unread + overdue + pending)", "Done", "Sidebar item with rose count, polls every 60s, per-user toggle."),
    # Sidebar + nav
    ("UI", "Sidebar polish: per-section colors + animations", "Done", "Right-click section header to tint; user-curated palette."),
    ("UI", "Drag-to-reorder sidebar groups + show/hide", "Done", "Persisted in preferences.sidebarOrder."),
    ("UI", "Top-corner draggable clock (digital/analog)", "Done", "Right-click for colour, format, timezone, mode."),
    ("UI", "Scrolling feed ticker (pin/unpin/drag/resize)", "Done", "Top or bottom; speed control."),
    ("UI", "Floating draggable task timer", "Done", "Connects to per-task time tracking."),
    ("UI", "Right-click everywhere: items, feed, page background", "Done", "Color, archive, share to feed, change priority, etc."),
    ("UI", "Tooltips foundation + Hint wrapper", "Done", "Sprinkled across icon-only buttons."),
    ("UI", "Settings page → admin-style top tabs", "Done", "5 tabs (Account / Data / Look / Integrations / Help)."),
    ("UI", "Onboarding tour (7 steps)", "Done", "Runs once for new users; replay from Settings → Help."),
    # Element pages
    ("Element pages", "Inline title editor on every element page", "Done", "Click title → editable, optimistic save."),
    ("Element pages", "Send-as-email button on every element page", "Done", "Template engine; 4 built-in templates; works on project/page/canvas/todo/process."),
    ("Element pages", "Watch / unwatch elements", "Done", "Counter shows total watchers."),
    ("Element pages", "Custom fields (text, number, date, select, etc.)", "Done", "Explainer panel + one-click example field seeder."),
    ("Element pages", "Save project as template", "Done", "Snapshots statuses + tasks + subtasks; dates and assignees intentionally stripped."),
    # Telegram bot
    ("Telegram", "Multi-user bot — each user wires their own token", "Done", "Webhook receives per-user; no shared state."),
    ("Telegram", "Telegram → FlowSpace import flow with approval bell", "Done", "Pastes get parked as pending; user approves from bell."),
    ("Telegram", "Inline keyboard navigation (main menu, tap-to-act)", "Done", "Plus pagination for long lists."),
    ("Telegram", "/tasks /deadlines /projects /lists /stats /search /digest", "Done", "Full read/insight command set."),
    ("Telegram", "Smart capture: !priority @date #tags", "Done", "Sprinkle tokens in any message; parser pulls them out."),
    ("Telegram", "Task edit power — reschedule / priority / status / delete", "Done", "Inline keyboards drive each."),
    ("Telegram", "Voice IN — transcribe via Groq Whisper", "Done", "Per-message language picker + 'skip' auto-mode."),
    ("Telegram", "Voice OUT — bot speaks replies via TTS", "Done", "Uses user's OpenAI-compatible /audio/speech endpoint."),
    ("Telegram", "Natural-language commands via AI provider", "Done", "Routes freeform text through the user's AI; falls back to capture."),
    ("Telegram", "Morning + evening daily digest cron", "Done", "Per-bot enable + time; uses last_sent to dedupe."),
    ("Telegram", "Message history (last 50) in Settings", "Done", "Inbound + outbound; clear button."),
    ("Telegram", "Customizable bot reply templates", "Done", "Six moments editable from Settings with variable chips."),
    ("Telegram", "Per-user 'own key vs shared workspace key' voice toggle", "Done", "Don't drain the shared Groq quota by default."),
    # Email
    ("Email", "Send any element as email + template engine", "Done", "Built-in templates per element type; variable substitution."),
    ("Email", "Email IN webhook + bell-badge approval queue", "Done", "Resend/Postmark/etc. compatible; per-user routing by local-part."),
    # AI
    ("AI", "Generic AI provider settings (OpenAI / Ollama / Gemini / Anthropic)", "Done", "Per-user keys stay in browser; one config block powers chat + classify + TTS."),
    ("AI", "AI-import: markdown spec + parser + import dialog", "Done", "Paste structured markdown → projects + tasks + lists in one click."),
    # Infra
    ("Infra", "PWA: manifest + icons + service worker", "Done", "Install banner on first visit; offline shell cache."),
    ("Infra", "HTTPS via Caddy + Let's Encrypt", "Done", "Auto-renewal."),
    ("Infra", "Cloudflare proxy enabled for DDoS protection", "Done", "Plus DNS hidden behind orange-cloud."),
    ("Infra", "i18n scaffolding (en/ar) + RTL switch", "Done", "Provider + dictionary + 60 keys + Settings switcher. Coverage of full UI is in progress."),
    ("Infra", "Google Calendar one-way sync (tasks → events)", "Verify", "Code shipped — OAuth + cron + sync engine wired; not yet tested end-to-end."),
    ("Infra", "Self-hosted faster-whisper sidecar", "Done", "docker-compose + docs; voice module routes to local URL when TELEGRAM_VOICE_LOCAL_URL is set."),
    ("Infra", "Backups: create / restore / delete from Admin", "Done", "Auto-backup retention + manual snapshot button."),
    # Productivity widgets
    ("Productivity", "Pomodoro focus timer widget", "Done", "Focus 25 → short 5 → long 15 after 4 blocks; logs to DB."),
    ("Productivity", "Habit tracker (/habits)", "Done", "Daily/weekly cadence, streak counter, archive."),
    ("Productivity", "Web clipper — bookmarklet + Chrome extension stub", "Done", "POSTs current tab to /api/clip with bearer token."),
    # Docs
    ("Docs", "Teams integration feasibility study", "Done", "docs/TEAMS_INTEGRATION.md compares webhook / Power Automate / Bot Framework."),
    ("Docs", "Self-hosted Whisper deployment guide", "Done", "docs/SELF_HOSTED_WHISPER.md + deploy/docker-compose.whisper.yml."),
    ("Docs", "Web clipper docs", "Done", "Bookmarklet snippet + extension load instructions."),
]
write_table(ws, delivered_headers, delivered_rows, status_col_index=3)
auto_width(ws, [16, 56, 12, 80])
for r in range(2, len(delivered_rows) + 2):
    ws.row_dimensions[r].height = 32

# ─── Sheet 3: Bugs to Fix ───────────────────────────────────────────────
ws = wb.create_sheet("Bugs to Fix")

bug_headers = ["#", "Area", "Bug", "Status", "Estimated effort", "Root cause / approach"]
bug_rows = [
    (1, "Mobile UI", "Topbar clock + task timer + date eat the screen on phones",
     "Bug", "~2 hours",
     "Widgets designed for desktop. Add `< sm` responsive breakpoints: collapse to icon-only, hide date chip on `< md`."),
    (2, "Mobile UI", "Settings checkboxes (e.g. clock display toggle) don't respond on mobile",
     "Bug", "~3 hours",
     "Most clock controls are behind a right-click context menu. Mobile has no right-click. Add long-press handler OR a visible gear button."),
    (3, "Speech", "Home-page capture mic is less accurate than the Telegram bot",
     "Bug", "~1 hour",
     "Home uses Web Speech API (browser-native, free, less accurate). Telegram uses Groq Whisper. Add engine toggle on home capture matching Settings → Speech."),
    (4, "i18n", "Arabic isn't fully integrated — most UI text is still English even when locale=ar",
     "Bug", "~2 days",
     "Scaffold landed (provider + 60 keys + RTL flip). Still need t('…') wrapping for every <button>/<label>/<placeholder> in home, todo, project, settings."),
    (5, "Calendar sync", "Google Calendar sync — not verified to actually work end-to-end",
     "Verify", "30 min",
     "Check: GOOGLE_CLIENT_ID/SECRET on VM, calendar.events scope on consent screen, redirect URI matches /api/auth/google-calendar/callback. Probably works; needs a real round-trip."),
]
write_table(ws, bug_headers, bug_rows, status_col_index=4)
auto_width(ws, [5, 16, 60, 12, 16, 80])
for r in range(2, len(bug_rows) + 2):
    ws.row_dimensions[r].height = 60

# ─── Sheet 4: Quick wins ────────────────────────────────────────────────
ws = wb.create_sheet("Quick wins")

qw_headers = ["#", "Feature", "Effort", "Status", "Notes"]
qw_rows = [
    (1, "/clear command for Telegram bot — wipe my message history",
     "<1 hour", "Easy",
     "One server action + one bot command. Already have the table; just DELETE WHERE user_id = ?."),
    (2, "Delete-last-entry button after a Telegram capture (undo)",
     "<1 hour", "Easy",
     "Inline keyboard '↩️ Undo' on success; soft-deletes the just-created todo."),
    (3, "Mobile-friendly priority + due date controls on todo items",
     "~3 hours", "Easy",
     "Long-press or tap-to-expand reveal icons. Right-click already has the full menu on desktop."),
    (4, "Help button → markdown templates viewer with 'copy'",
     "~3 hours", "Easy",
     "Render docs/AI_IMPORT_FORMAT.md as code blocks with copy buttons. 'Use as template' → seed templates row."),
    (5, "Add project-markdown templates to Help (sprint, content calendar, OKR)",
     "~2 hours", "Easy",
     "Bake 3-4 markdown blueprints into the template seeder."),
    (6, "Deep-link button: Telegram reply → opens the FlowSpace page",
     "<1 hour", "Easy",
     "Compose t.me/<bot> + element URL. Already build the URL in send-element-email-actions; reuse."),
    (7, "Reminder via Telegram (set in app, DMed to phone)",
     "~Already built", "Verify",
     "Cron telegram:remind already exists. Just confirm it fires for the current user."),
    (8, "Telegram language preference saved once, never asked again",
     "~1 hour", "Easy",
     "Tighten the voice_auto_skip respect so the language picker stops appearing once set."),
    (9, "Arabic on login + globe / flag picker (US + KSA)",
     "~1 hour", "Easy",
     "Reuse <LocaleSwitcher>; shrink to a 2-flag chip in the login form header."),
    (10, "Export todo list → Excel + send by email",
     "~3 hours", "Easy",
     "openpyxl export action; attach to send-element-email-dialog as .xlsx."),
    (11, "Search bar in admin settings",
     "~2 hours", "Easy",
     "Reuse command palette component scoped to admin sections."),
    (12, "Investigate todo-list item limit (none enforced)",
     "30 min", "Verify",
     "No code cap. SQLite handles millions. Confirm not seeing UI perf issues."),
]
write_table(ws, qw_headers, qw_rows, status_col_index=4)
auto_width(ws, [5, 70, 14, 12, 80])
for r in range(2, len(qw_rows) + 2):
    ws.row_dimensions[r].height = 45

# ─── Sheet 5: Medium ────────────────────────────────────────────────────
ws = wb.create_sheet("Medium")

m_headers = ["#", "Feature", "Effort", "Status", "Notes"]
m_rows = [
    (1, "Image upload + LLM vision analysis",
     "~1 day", "Medium",
     "aiVisionModel setting already exists. Need upload form + multipart to LLM + store result. Works with OpenAI/Gemini."),
    (2, "PDF + CSV upload + parse",
     "~1 day", "Medium",
     "PDF via pdf-parse; CSV via papaparse. Land content as a Page; optional LLM summary."),
    (3, "Chat with LLM about your platform (voice + text)",
     "~2 days", "Medium",
     "Sidebar drawer chat; read access to elements; uses existing speech + AI provider."),
    (4, "Global search across descriptions, page content, comments, custom fields",
     "~2 days", "Medium",
     "SQLite FTS5 virtual table; index on insert/update; ranked results in command palette."),
    (5, "Groq voice quota indicator",
     "~3 hours", "Medium",
     "Groq has no balance endpoint. Best we can do: track our own usage (count + seconds today) and surface it. Real quota lives on Groq dashboard."),
    (6, "Canvas configuration menu",
     "~1 day", "Medium",
     "Audit what's already there. Likely add grid size, snap, default node type, background colour."),
]
write_table(ws, m_headers, m_rows, status_col_index=4)
auto_width(ws, [5, 60, 14, 12, 80])
for r in range(2, len(m_rows) + 2):
    ws.row_dimensions[r].height = 45

# ─── Sheet 6: Heavy & External ──────────────────────────────────────────
ws = wb.create_sheet("Heavy & External")

h_headers = ["#", "Feature", "Effort", "Status", "Cost / constraint", "Notes"]
h_rows = [
    (1, "TikTok integration",
     "~1 week", "Constrained", "Free, but limited API",
     "Public API only does login + basic profile. 'Schedule a post' requires TikTok for Business + Content Posting API approval. Realistic: post a TikTok link → FlowSpace pulls metadata."),
    (2, "Twitter / X integration",
     "~3 days", "Paid", "$100+/month",
     "Free tier is dead. Basic tier ~$100/mo for 50k reads + 3k writes. Code is just REST. Decide if the bill is worth it."),
    (3, "WhatsApp Business integration",
     "~1 week + 2-week approval", "Blocked", "Meta verification + dedicated number",
     "WA Business API needs Meta-verified account + dedicated phone number you can't use for personal WA. Cheaper but ToS-violating alternative is WA Web automation."),
    (4, "Video → frames → LLM analysis bot",
     "~2-3 days", "Heavy", "Compute-heavy",
     "Server-side ffmpeg -vf fps=1 → frames → vision LLM per frame → summary. Vision calls add up fast. Limit to short videos (<1 min)."),
]
write_table(ws, h_headers, h_rows, status_col_index=4)
auto_width(ws, [5, 38, 24, 14, 32, 80])
for r in range(2, len(h_rows) + 2):
    ws.row_dimensions[r].height = 65

# ─── Sheet 7: Recommended order ─────────────────────────────────────────
ws = wb.create_sheet("Recommended order")

ws["A1"] = "Suggested execution order"
ws["A1"].font = Font(name="Arial", bold=True, size=14, color="1E293B")

ordered = [
    ("Step 1", "~1 day", "Bug batch", "Mobile sizing + mobile checkbox + home-mic engine + Arabic finishing. Makes everything else feel solid."),
    ("Step 2", "30 min", "Verify Google Calendar end-to-end", "Either celebrate or I learn what's broken."),
    ("Step 3", "~1 day", "Quick-wins bundle", "/clear, /undo, login flag picker, Excel export, search-in-admin, NL language sticky."),
    ("Step 4", "~3 days", "Ingest + global search", "Image, PDF, CSV upload + FTS5 search across descriptions, pages, comments."),
    ("Step 5", "~2 days", "Voice/text chat with LLM about your platform", "Sidebar drawer."),
    ("Step 6", "—", "Decide on social integrations", "TikTok/Twitter/WhatsApp need budget + approvals. Choose before building."),
]
headers = ["Step", "Effort", "Theme", "What's in it"]
for col_idx, label in enumerate(headers, start=1):
    c = ws.cell(row=3, column=col_idx, value=label)
    c.fill = HEADER_FILL
    c.font = HEADER_FONT
    c.alignment = CENTER
    c.border = BORDER

for row_idx, row in enumerate(ordered, start=4):
    for col_idx, value in enumerate(row, start=1):
        c = ws.cell(row=row_idx, column=col_idx, value=value)
        c.font = BODY_FONT
        c.alignment = WRAP
        c.border = BORDER
        if row_idx % 2 == 0:
            c.fill = STRIPE_FILL
    ws.row_dimensions[row_idx].height = 50

ws.freeze_panes = "A4"
auto_width(ws, [12, 14, 42, 90])

# ─── Reorder + write ────────────────────────────────────────────────────
wb._sheets = [
    wb["Summary"],
    wb["Delivered"],
    wb["Bugs to Fix"],
    wb["Quick wins"],
    wb["Medium"],
    wb["Heavy & External"],
    wb["Recommended order"],
]

OUT = r"C:\Users\malfa\OneDrive\سطح المكتب\flowspace-status.xlsx"
wb.save(OUT)
print(f"Saved: {os.path.basename(OUT)} ({os.path.getsize(OUT)} bytes)")

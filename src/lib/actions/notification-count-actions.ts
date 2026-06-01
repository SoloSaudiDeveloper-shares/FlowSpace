"use server"

/**
 * Aggregate notification count for the sidebar bell badge.
 *
 * Combines four signals into one badge number:
 *   - Unread notifications (notifications.is_read = 0)
 *   - Pending imports (telegram pastes waiting for review)
 *   - Overdue tasks (due_date < now, not done)
 *   - Overdue reminders (remind_at < now, not dismissed)
 *
 * Scoped per user. Returns zero on auth error rather than throwing so
 * the badge never breaks the page.
 */

import { sqlite } from "@/lib/db"
import { currentUserId } from "@/lib/auth/scope"

export interface NotificationCounts {
  total: number
  unreadNotifications: number
  pendingImports: number
  pendingEmails: number
  overdueTasks: number
  overdueReminders: number
}

export async function getMyNotificationCount(): Promise<NotificationCounts> {
  const empty: NotificationCounts = {
    total: 0,
    unreadNotifications: 0,
    pendingImports: 0,
    pendingEmails: 0,
    overdueTasks: 0,
    overdueReminders: 0,
  }
  const uid = await currentUserId()
  if (!uid) return empty

  const nowIso = new Date().toISOString()

  // Unread notifications scoped to this user (notifications table tracks
  // user_id for global notifications, or via element ownership).
  const unread = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM notifications n
       LEFT JOIN elements e ON e.id = n.element_id
       WHERE n.is_read = 0
         AND (n.user_id = ? OR e.created_by = ?)`,
    )
    .get(uid, uid) as { n: number }

  const pending = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM pending_imports
       WHERE user_id = ? AND status = 'pending'`,
    )
    .get(uid) as { n: number }

  const pendingEmailsRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM inbound_emails
        WHERE user_id = ? AND status = 'pending'`,
    )
    .get(uid) as { n: number }

  // Overdue = strictly before today. Task due dates are stored date-only, so
  // normalize both sides with date() (a raw string compare against a full ISO
  // "now" would wrongly count tasks due *today* as overdue).
  const overdueTasksRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?
         AND t.due_date IS NOT NULL
         AND date(t.due_date) < date('now','localtime')
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)`,
    )
    .get(uid) as { n: number }

  const overdueRemindersRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM reminders r
       INNER JOIN elements e ON e.id = r.id
       WHERE e.created_by = ?
         AND r.is_dismissed = 0
         AND r.remind_at < ?`,
    )
    .get(uid, nowIso) as { n: number }

  const counts: NotificationCounts = {
    unreadNotifications: unread.n ?? 0,
    pendingImports: pending.n ?? 0,
    pendingEmails: pendingEmailsRow.n ?? 0,
    overdueTasks: overdueTasksRow.n ?? 0,
    overdueReminders: overdueRemindersRow.n ?? 0,
    total: 0,
  }
  counts.total =
    counts.unreadNotifications +
    counts.pendingImports +
    counts.pendingEmails +
    counts.overdueTasks +
    counts.overdueReminders
  return counts
}

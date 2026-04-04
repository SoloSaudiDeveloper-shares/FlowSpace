"use server"

import { db } from "@/lib/db"
import { reminders, elements } from "@/lib/db/schema"
import { eq, and, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getReminder(id: string) {
  const result = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function getAllReminders() {
  return db
    .select({
      reminder: reminders,
      element: elements,
    })
    .from(reminders)
    .innerJoin(elements, eq(reminders.id, elements.id))
    .where(
      and(
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )
}

export async function updateReminder(
  id: string,
  data: {
    remindAt?: string
    repeatRule?: string | null
    isDismissed?: boolean
    snoozedUntil?: string | null
  }
) {
  await db.update(reminders).set(data).where(eq(reminders.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, id))

  revalidatePath("/reminders")
}

export async function getDueReminders() {
  const now = new Date().toISOString()
  return db
    .select({
      reminder: reminders,
      element: elements,
    })
    .from(reminders)
    .innerJoin(elements, eq(reminders.id, elements.id))
    .where(
      and(
        lte(reminders.remindAt, now),
        eq(reminders.isDismissed, false),
        eq(elements.isDeleted, false)
      )
    )
}

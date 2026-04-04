"use server"

import { db } from "@/lib/db"
import { pages, elements } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getPageContent(id: string) {
  const result = await db
    .select()
    .from(pages)
    .where(eq(pages.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function savePageContent(id: string, content: string) {
  await db.update(pages).set({ content }).where(eq(pages.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, id))
}

export async function savePageCover(id: string, coverImage: string | null) {
  await db.update(pages).set({ coverImage }).where(eq(pages.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, id))
  revalidatePath(`/pages/${id}`)
}

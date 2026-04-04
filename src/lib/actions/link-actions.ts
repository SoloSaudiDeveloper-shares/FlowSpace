"use server"

import { db } from "@/lib/db"
import { elementLinks, elements } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, or, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function createLink(
  sourceId: string,
  targetId: string,
  linkType: "reference" | "dependency" | "contains" | "blocks" | "relates_to"
) {
  const id = createId()
  await db.insert(elementLinks).values({
    id,
    sourceId,
    targetId,
    linkType,
  })
  revalidatePath("/")
  return id
}

export async function deleteLink(id: string) {
  await db.delete(elementLinks).where(eq(elementLinks.id, id))
  revalidatePath("/")
}

export async function getLinksForElement(elementId: string) {
  const links = await db
    .select()
    .from(elementLinks)
    .where(
      or(
        eq(elementLinks.sourceId, elementId),
        eq(elementLinks.targetId, elementId)
      )
    )

  // Get all related element IDs
  const relatedIds = new Set<string>()
  links.forEach((link) => {
    if (link.sourceId !== elementId) relatedIds.add(link.sourceId)
    if (link.targetId !== elementId) relatedIds.add(link.targetId)
  })

  // Fetch related elements
  const relatedElements = relatedIds.size > 0
    ? await db
        .select()
        .from(elements)
        .where(
          and(
            eq(elements.isDeleted, false),
          )
        )
        .then((all) => all.filter((el) => relatedIds.has(el.id)))
    : []

  const elementMap = new Map(relatedElements.map((el) => [el.id, el]))

  return links.map((link) => ({
    ...link,
    relatedElement: elementMap.get(
      link.sourceId === elementId ? link.targetId : link.sourceId
    ),
    direction: link.sourceId === elementId ? "outgoing" : "incoming",
  }))
}

export async function searchElements(query: string, excludeId?: string) {
  const allElements = await db
    .select()
    .from(elements)
    .where(
      and(
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )

  const q = query.toLowerCase()
  return allElements
    .filter(
      (el) =>
        el.id !== excludeId &&
        el.title.toLowerCase().includes(q)
    )
    .slice(0, 10)
}

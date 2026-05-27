/**
 * Incremental Embeddings Index
 *
 * Uses Ollama embeddings (via aiManager) to enable semantic search.
 * Vectors are cached in IndexedDB with hash-based change detection
 * so only new/modified items are re-embedded on each sync.
 */

import { aiManager } from "./ai-manager"

// ─── Types ───────────────────────────────────────────────────────────────

interface StoredItem {
  id: string
  text: string
  vector: number[]
  metadata?: Record<string, string>
  textHash: string
  indexedAt: string
}

export interface SyncStats {
  added: number
  updated: number
  removed: number
  unchanged: number
}

export interface SyncEntry {
  id: string
  text: string
  updatedAt: string
  metadata?: Record<string, string>
}

// ─── FNV-1a Hash ─────────────────────────────────────────────────────────

function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5 // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime (32-bit)
  }
  // Convert to unsigned 32-bit then to hex
  return (hash >>> 0).toString(16).padStart(8, "0")
}

// ─── Cosine Similarity ───────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}

// ─── IndexedDB Cache (v2) ───────────────────────────────────────────────

const DB_NAME = "flowspace-embeddings"
const STORE_NAME = "vectors"
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      // Drop the old v1 store and recreate with new schema
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      db.createObjectStore(STORE_NAME, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadAllFromDB(): Promise<StoredItem[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result ?? [])
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

async function putItemsToDB(items: StoredItem[]): Promise<void> {
  if (items.length === 0) return
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    for (const item of items) {
      store.put(item)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Ignore cache write errors
  }
}

async function deleteItemsFromDB(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    for (const id of ids) {
      store.delete(id)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Ignore cache delete errors
  }
}

async function clearDB(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).clear()
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Ignore
  }
}

// ─── Embeddings Index ────────────────────────────────────────────────────

class EmbeddingsIndex {
  private items: Map<string, StoredItem> = new Map()
  private loaded = false
  private modelId = "nomic-embed-text"

  /** Load cached vectors from IndexedDB into memory. */
  async load(): Promise<void> {
    if (this.loaded) return
    const cached = await loadAllFromDB()
    this.items = new Map(cached.map((item) => [item.id, item]))
    this.loaded = true
  }

  /**
   * Incrementally sync the index with a new set of entries.
   *
   * - Compares hashes and timestamps to detect changes
   * - Only embeds new and changed items
   * - Removes items no longer in the source data
   * - Returns stats about what changed
   */
  async syncIndex(entries: SyncEntry[]): Promise<SyncStats> {
    // Ensure cache is loaded
    if (!this.loaded) {
      await this.load()
    }

    const now = new Date().toISOString()
    const incomingIds = new Set(entries.map((e) => e.id))

    // ── Detect deletions: items in cache but not in incoming ──
    const removedIds: string[] = []
    for (const cachedId of this.items.keys()) {
      if (!incomingIds.has(cachedId)) {
        removedIds.push(cachedId)
      }
    }

    // ── Classify incoming entries ──
    const toEmbed: SyncEntry[] = []
    let unchanged = 0

    for (const entry of entries) {
      const cached = this.items.get(entry.id)
      if (!cached) {
        // New item, needs embedding
        toEmbed.push(entry)
        continue
      }

      // Check timestamp first (fast path): if source hasn't been
      // updated since we last indexed, skip entirely
      if (cached.indexedAt && entry.updatedAt <= cached.indexedAt) {
        unchanged++
        continue
      }

      // Timestamp indicates a potential change. Verify via content hash
      // to avoid re-embedding if only non-text fields changed.
      const hash = fnv1aHash(entry.text)
      if (hash === cached.textHash) {
        // Content is the same; update indexedAt so we skip faster next time
        cached.indexedAt = now
        unchanged++
        continue
      }

      // Content actually changed
      toEmbed.push(entry)
    }

    // Count new vs updated
    let added = 0
    let updated = 0
    for (const entry of toEmbed) {
      if (this.items.has(entry.id)) {
        updated++
      } else {
        added++
      }
    }

    // ── Embed new + changed items in batches ──
    const BATCH_SIZE = 32
    const freshItems: StoredItem[] = []

    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE)
      const result = await aiManager.embed(this.modelId, {
        texts: batch.map((e) => e.text),
      })

      for (let j = 0; j < batch.length; j++) {
        const entry = batch[j]
        freshItems.push({
          id: entry.id,
          text: entry.text,
          vector: result.embeddings[j],
          metadata: entry.metadata,
          textHash: fnv1aHash(entry.text),
          indexedAt: now,
        })
      }
    }

    // ── Apply changes to in-memory index ──

    // Remove deleted items
    for (const id of removedIds) {
      this.items.delete(id)
    }

    // Upsert fresh items
    for (const item of freshItems) {
      this.items.set(item.id, item)
    }

    // ── Persist to IndexedDB ──
    await Promise.all([
      putItemsToDB(freshItems),
      deleteItemsFromDB(removedIds),
    ])

    // Also persist any items whose indexedAt was bumped (unchanged but
    // timestamp refreshed) so future syncs are faster
    const timestampRefreshed = entries.filter((e) => {
      const cached = this.items.get(e.id)
      return (
        cached &&
        cached.indexedAt === now &&
        !freshItems.some((f) => f.id === e.id)
      )
    })
    if (timestampRefreshed.length > 0) {
      const toUpdate = timestampRefreshed
        .map((e) => this.items.get(e.id)!)
        .filter(Boolean)
      await putItemsToDB(toUpdate)
    }

    return {
      added,
      updated,
      removed: removedIds.length,
      unchanged,
    }
  }

  /**
   * Legacy index method. Delegates to syncIndex internally.
   * Kept for backward compatibility.
   */
  async index(
    entries: { id: string; text: string; metadata?: Record<string, string> }[],
  ): Promise<void> {
    const syncEntries: SyncEntry[] = entries.map((e) => ({
      ...e,
      updatedAt: new Date().toISOString(),
    }))
    await this.syncIndex(syncEntries)
  }

  /**
   * Semantic search over indexed items.
   * Returns results sorted by cosine similarity, filtered by minScore.
   */
  async search(
    query: string,
    topK = 10,
    minScore = 0.3,
  ): Promise<{ id: string; score: number; text: string; metadata?: Record<string, string> }[]> {
    if (this.items.size === 0) return []

    // Embed query
    const result = await aiManager.embed(this.modelId, {
      texts: [query],
    })
    const queryVector = result.embeddings[0]

    // Score all items
    const scored: { id: string; score: number; text: string; metadata?: Record<string, string> }[] = []
    for (const item of this.items.values()) {
      const score = cosineSimilarity(queryVector, item.vector)
      if (score >= minScore) {
        scored.push({
          id: item.id,
          score,
          text: item.text,
          metadata: item.metadata,
        })
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  /** Remove a single item by id from the in-memory index and IndexedDB. */
  async remove(id: string): Promise<void> {
    this.items.delete(id)
    await deleteItemsFromDB([id])
  }

  /** Clear the entire index (memory + IndexedDB). */
  async clear(): Promise<void> {
    this.items = new Map()
    await clearDB()
  }

  /** Number of items currently in the index. */
  get size(): number {
    return this.items.size
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────

export const embeddingsIndex = new EmbeddingsIndex()

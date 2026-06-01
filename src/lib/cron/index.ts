/**
 * Tiny in-process cron for background jobs.
 *
 * We don't need real cron — just a single setInterval per server that
 * runs every minute and dispatches to registered jobs. The interval is
 * a singleton (guarded by a global flag) so HMR + multiple imports
 * during dev don't spawn duplicate timers.
 *
 * Jobs MUST be idempotent — we may fire the same minute twice if the
 * server restarts; jobs decide what "already done" means (e.g.,
 * reminders check `bot_fired_at`).
 *
 * To run on server boot, this module is imported from `src/lib/db/index.ts`
 * which is the earliest server-side module that always loads.
 */

import "server-only"

type Job = {
  name: string
  /** Run this job on every tick. Should return quickly — heavy work
   *  should be its own job, not awaited inline. */
  run: () => Promise<void> | void
}

const jobs: Job[] = []
const TICK_MS = 60_000

declare global {
   
  var __flowspace_cron_started: boolean | undefined
}

export function registerJob(job: Job) {
  jobs.push(job)
}

export function startCron() {
  if (globalThis.__flowspace_cron_started) return
  globalThis.__flowspace_cron_started = true
  setInterval(tick, TICK_MS)
  // Run once immediately so freshly-due reminders don't wait a full minute
  // after boot.
  void tick()
}

async function tick() {
  for (const job of jobs) {
    try {
      await job.run()
    } catch (err) {
      console.error(`[cron] ${job.name} failed:`, err)
    }
  }
}

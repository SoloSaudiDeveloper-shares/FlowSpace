import path from "node:path"

/**
 * Resolves the directory where SQLite, uploads, and backups live.
 *
 * Order of precedence:
 * 1. `FLOWSPACE_DATA_DIR` env var (absolute or relative to cwd)
 * 2. `DATA_DIR` env var (same)
 * 3. `<process.cwd()>/data` — desktop / FlowSpace.bat default
 *
 * For Railway / Fly / Render: set DATA_DIR=/data and mount a persistent
 * volume there. The directory will be created on first run if missing.
 */
export function getDataDir(): string {
  const fromEnv = process.env.FLOWSPACE_DATA_DIR || process.env.DATA_DIR
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv)
  }
  return path.join(process.cwd(), "data")
}

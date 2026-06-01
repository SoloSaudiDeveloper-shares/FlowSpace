/**
 * Aggregates every per-area dictionary module into one EN / AR map.
 * Add a new area by creating `./<area>.ts` (exporting `en` and `ar`),
 * importing it here, and adding it to the `modules` array.
 */

import * as core from "./core"
import * as home from "./home"
import * as projectViews from "./project-views"
import * as taskDetail from "./task-detail"
import * as settings from "./settings"
import * as feed from "./feed"
import * as forms from "./forms"
import * as automations from "./automations"
import * as people from "./people"
import * as misc from "./misc"

const modules = [
  core,
  home,
  projectViews,
  taskDetail,
  settings,
  feed,
  forms,
  automations,
  people,
  misc,
]

export const EN: Record<string, string> = Object.assign({}, ...modules.map((m) => m.en))
export const AR: Record<string, string> = Object.assign({}, ...modules.map((m) => m.ar))

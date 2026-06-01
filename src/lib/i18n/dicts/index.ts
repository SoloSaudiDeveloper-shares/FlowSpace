/**
 * Aggregates every per-area dictionary module into one EN / AR map.
 * Add a new area by creating `./<area>.ts` (exporting `en` and `ar`),
 * importing it here, and adding it to the `modules` array.
 */

import * as core from "./core"
import * as home from "./home"
import * as projectViews from "./project-views"
import * as projectExtra from "./project-extra"
import * as taskDetail from "./task-detail"
import * as settings from "./settings"
import * as feed from "./feed"
import * as forms from "./forms"
import * as automations from "./automations"
import * as people from "./people"
import * as templates from "./templates"
import * as layout from "./layout"
import * as shared from "./shared"
import * as misc from "./misc"
import * as auth from "./auth"
import * as canvas from "./canvas"
import * as misc2 from "./misc2"

const modules = [
  core,
  home,
  projectViews,
  projectExtra,
  taskDetail,
  settings,
  feed,
  forms,
  automations,
  people,
  templates,
  layout,
  shared,
  misc,
  auth,
  canvas,
  misc2,
]

export const EN: Record<string, string> = Object.assign({}, ...modules.map((m) => m.en))
export const AR: Record<string, string> = Object.assign({}, ...modules.map((m) => m.ar))

/**
 * Curated, categorized emoji library for the icon picker. Each emoji carries a
 * short keyword string so the picker's search can match it. Not exhaustive —
 * the picker also lets users upload a custom image — but broad enough to cover
 * everyday tasks (travel, work, money, people, etc.).
 */

export interface EmojiEntry {
  /** The emoji character. */
  c: string
  /** Space-separated search keywords. */
  k: string
}

export interface EmojiCategory {
  id: string
  label: string
  emojis: EmojiEntry[]
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "common",
    label: "Common",
    emojis: [
      { c: "⭐", k: "star favorite important" },
      { c: "✅", k: "check done complete tick" },
      { c: "❗", k: "important exclamation" },
      { c: "🔥", k: "fire hot urgent trending" },
      { c: "💡", k: "idea light bulb tip" },
      { c: "📌", k: "pin pinned" },
      { c: "📍", k: "location pin place" },
      { c: "🎯", k: "target goal aim" },
      { c: "⏰", k: "alarm time clock reminder" },
      { c: "📅", k: "calendar date schedule" },
      { c: "🔔", k: "bell notification reminder" },
      { c: "❤️", k: "heart love" },
      { c: "👍", k: "thumbs up ok good" },
      { c: "⚡", k: "lightning fast energy power" },
      { c: "🚀", k: "rocket launch ship fast" },
      { c: "🏆", k: "trophy win award" },
      { c: "🎉", k: "party celebrate done" },
      { c: "❓", k: "question unknown" },
      { c: "⚠️", k: "warning caution" },
      { c: "🔒", k: "lock secure private" },
    ],
  },
  {
    id: "work",
    label: "Work",
    emojis: [
      { c: "💼", k: "briefcase work business job" },
      { c: "📊", k: "chart stats analytics report" },
      { c: "📈", k: "chart up growth increase" },
      { c: "📉", k: "chart down decrease" },
      { c: "🗂️", k: "files folders organize" },
      { c: "📁", k: "folder files" },
      { c: "📂", k: "folder open" },
      { c: "📝", k: "memo note write task" },
      { c: "✏️", k: "pencil edit write" },
      { c: "🖊️", k: "pen write sign" },
      { c: "📋", k: "clipboard list tasks" },
      { c: "📎", k: "paperclip attach" },
      { c: "🖇️", k: "clip link" },
      { c: "📑", k: "tabs bookmark documents" },
      { c: "🗒️", k: "notepad notes" },
      { c: "💻", k: "laptop computer work" },
      { c: "🖥️", k: "desktop computer monitor" },
      { c: "⌨️", k: "keyboard type" },
      { c: "🖨️", k: "printer print" },
      { c: "📞", k: "phone call" },
      { c: "📧", k: "email mail message" },
      { c: "🤝", k: "handshake deal meeting agreement" },
      { c: "👔", k: "tie business formal" },
      { c: "🏢", k: "office building company" },
    ],
  },
  {
    id: "money",
    label: "Money",
    emojis: [
      { c: "💰", k: "money bag cash" },
      { c: "💵", k: "dollar cash money" },
      { c: "💳", k: "card credit pay" },
      { c: "🪙", k: "coin money" },
      { c: "💸", k: "money fly spend cost" },
      { c: "🧾", k: "receipt bill invoice" },
      { c: "🏦", k: "bank money" },
      { c: "💲", k: "dollar sign money" },
      { c: "📥", k: "inbox receive income" },
      { c: "📤", k: "outbox send expense" },
      { c: "🛒", k: "cart shopping buy" },
      { c: "🛍️", k: "shopping bags buy" },
      { c: "🏷️", k: "tag price label" },
    ],
  },
  {
    id: "travel",
    label: "Travel",
    emojis: [
      { c: "✈️", k: "plane flight travel airport fly" },
      { c: "🛫", k: "departure takeoff flight" },
      { c: "🛬", k: "arrival landing flight" },
      { c: "🧳", k: "luggage suitcase travel" },
      { c: "🪪", k: "id passport license card" },
      { c: "🛂", k: "passport control immigration" },
      { c: "🎫", k: "ticket pass" },
      { c: "🚗", k: "car drive" },
      { c: "🚕", k: "taxi cab" },
      { c: "🚌", k: "bus" },
      { c: "🚆", k: "train" },
      { c: "🚢", k: "ship boat cruise" },
      { c: "⛽", k: "fuel gas station" },
      { c: "🗺️", k: "map travel directions" },
      { c: "🧭", k: "compass navigate direction" },
      { c: "🏨", k: "hotel stay" },
      { c: "🏝️", k: "island beach vacation" },
      { c: "🏖️", k: "beach vacation holiday" },
      { c: "🌍", k: "world earth globe travel" },
      { c: "🛣️", k: "road highway trip" },
    ],
  },
  {
    id: "people",
    label: "People",
    emojis: [
      { c: "🧑", k: "person someone" },
      { c: "👤", k: "person profile user" },
      { c: "👥", k: "people group team" },
      { c: "👨", k: "man" },
      { c: "👩", k: "woman" },
      { c: "👶", k: "baby child" },
      { c: "👪", k: "family" },
      { c: "🧑‍💻", k: "developer coder work tech" },
      { c: "🧑‍🏫", k: "teacher class study" },
      { c: "🧑‍⚕️", k: "doctor health medical" },
      { c: "👮", k: "police officer" },
      { c: "🧑‍🍳", k: "chef cook food" },
      { c: "💪", k: "muscle strong gym" },
      { c: "🙏", k: "pray please thanks" },
      { c: "🧠", k: "brain think mind" },
      { c: "👀", k: "eyes look watch review" },
    ],
  },
  {
    id: "food",
    label: "Food",
    emojis: [
      { c: "🍎", k: "apple fruit" },
      { c: "🍌", k: "banana fruit" },
      { c: "🍞", k: "bread food" },
      { c: "🧀", k: "cheese food" },
      { c: "🍕", k: "pizza food" },
      { c: "🍔", k: "burger food" },
      { c: "🍜", k: "noodles ramen food" },
      { c: "🍣", k: "sushi food" },
      { c: "🥗", k: "salad healthy food" },
      { c: "🍰", k: "cake dessert" },
      { c: "☕", k: "coffee drink" },
      { c: "🍵", k: "tea drink" },
      { c: "🥤", k: "drink soda cup" },
      { c: "🍺", k: "beer drink" },
      { c: "🛒", k: "groceries shopping food" },
      { c: "🍳", k: "cooking egg food" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    emojis: [
      { c: "⚽", k: "soccer football sport" },
      { c: "🏀", k: "basketball sport" },
      { c: "🏋️", k: "gym workout lift exercise" },
      { c: "🏃", k: "run running exercise" },
      { c: "🚴", k: "cycling bike exercise" },
      { c: "🧘", k: "yoga meditate relax" },
      { c: "🎮", k: "game gaming play" },
      { c: "🎵", k: "music note song" },
      { c: "🎬", k: "movie film video" },
      { c: "📷", k: "camera photo picture" },
      { c: "📺", k: "tv watch show" },
      { c: "🎨", k: "art paint design" },
      { c: "📚", k: "books study read learn" },
      { c: "✍️", k: "writing study homework" },
      { c: "🎓", k: "graduation study school" },
      { c: "🛏️", k: "bed sleep rest" },
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      { c: "🏠", k: "home house" },
      { c: "🔑", k: "key access" },
      { c: "🧰", k: "toolbox tools fix" },
      { c: "🔧", k: "wrench fix tool" },
      { c: "🔨", k: "hammer build fix" },
      { c: "🪛", k: "screwdriver tool" },
      { c: "🧹", k: "broom clean chore" },
      { c: "🧺", k: "laundry basket chore" },
      { c: "🛁", k: "bath clean" },
      { c: "💊", k: "pill medicine health" },
      { c: "🩺", k: "stethoscope health doctor" },
      { c: "🌱", k: "plant grow seed" },
      { c: "🎁", k: "gift present" },
      { c: "📦", k: "package box delivery" },
      { c: "🔋", k: "battery power charge" },
      { c: "🧪", k: "experiment lab science test" },
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: [
      { c: "🔴", k: "red dot circle" },
      { c: "🟠", k: "orange dot circle" },
      { c: "🟡", k: "yellow dot circle" },
      { c: "🟢", k: "green dot circle" },
      { c: "🔵", k: "blue dot circle" },
      { c: "🟣", k: "purple dot circle" },
      { c: "⚫", k: "black dot circle" },
      { c: "⚪", k: "white dot circle" },
      { c: "❌", k: "x cancel no wrong" },
      { c: "➕", k: "plus add" },
      { c: "➖", k: "minus remove" },
      { c: "♻️", k: "recycle reuse" },
      { c: "🔁", k: "repeat loop recurring" },
      { c: "🔝", k: "top up priority" },
      { c: "✔️", k: "check tick done" },
      { c: "❤️", k: "heart love red" },
      { c: "💯", k: "100 perfect hundred" },
      { c: "🆕", k: "new" },
      { c: "🆗", k: "ok" },
      { c: "🚩", k: "flag mark report" },
    ],
  },
]

/** Flat search across all categories by keyword / emoji. */
export function searchEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: EmojiEntry[] = []
  const seen = new Set<string>()
  for (const cat of EMOJI_CATEGORIES) {
    for (const e of cat.emojis) {
      if (seen.has(e.c)) continue
      if (e.c === q || e.k.includes(q)) {
        out.push(e)
        seen.add(e.c)
      }
    }
  }
  return out
}

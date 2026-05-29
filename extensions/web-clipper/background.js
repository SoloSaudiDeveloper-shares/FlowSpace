// Service worker for the FlowSpace Web Clipper.
//
// Listens for messages from the popup, fetches the active tab info,
// gets the selection from the content script, and POSTs the payload
// to /api/clip with the user's bearer token.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "clip-current-tab") return false
  ;(async () => {
    try {
      const { baseUrl, token } = await chrome.storage.sync.get([
        "baseUrl",
        "token",
      ])
      if (!baseUrl || !token) {
        sendResponse({ ok: false, error: "Set FlowSpace URL + token in extension options." })
        return
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab." })
        return
      }
      // Grab any selected text via a content-script eval (chrome.scripting).
      let selection = ""
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() ?? "",
        })
        selection = result[0]?.result ?? ""
      } catch {
        // Some pages (chrome:// etc) block scripting; that's fine.
      }
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/clip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: tab.title ?? "(no title)",
          url: tab.url ?? "",
          selection,
        }),
      })
      sendResponse({ ok: res.ok, status: res.status })
    } catch (err) {
      sendResponse({ ok: false, error: String(err) })
    }
  })()
  return true // async response
})

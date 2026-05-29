const btn = document.getElementById("go")
const status = document.getElementById("status")
const opt = document.getElementById("opt")

btn.addEventListener("click", () => {
  btn.disabled = true
  status.textContent = "Sending…"
  chrome.runtime.sendMessage({ type: "clip-current-tab" }, (resp) => {
    if (resp?.ok) {
      status.textContent = "Saved to your FlowSpace inbox."
    } else {
      status.textContent = "Failed: " + (resp?.error ?? `HTTP ${resp?.status ?? "?"}`)
    }
    btn.disabled = false
  })
})

opt.addEventListener("click", (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

const baseUrlEl = document.getElementById("baseUrl")
const tokenEl = document.getElementById("token")
const saveBtn = document.getElementById("save")
const savedEl = document.getElementById("saved")

chrome.storage.sync.get(["baseUrl", "token"]).then(({ baseUrl, token }) => {
  if (baseUrl) baseUrlEl.value = baseUrl
  if (token) tokenEl.value = token
})

saveBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    baseUrl: baseUrlEl.value.trim(),
    token: tokenEl.value.trim(),
  })
  savedEl.hidden = false
  setTimeout(() => (savedEl.hidden = true), 1500)
})

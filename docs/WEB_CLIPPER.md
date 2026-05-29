# Web clipper

Two ways to send a webpage into FlowSpace:

## 1. Bookmarklet (works in any browser, zero install)

Issue an API token in Settings → Account → API tokens. Then drag this
URL into your bookmarks bar (replace `https://flowspace.example.com` and
`flws_…` with your values):

```javascript
javascript:(()=>{const s=window.getSelection().toString();fetch('https://flowspace.example.com/api/clip',{method:'POST',headers:{'Authorization':'Bearer flws_yourtoken','Content-Type':'application/json'},body:JSON.stringify({title:document.title,url:location.href,selection:s})}).then(r=>r.ok?alert('Saved to FlowSpace inbox'):alert('Failed: '+r.status))})()
```

Click on any page → it lands as a pending item in your FlowSpace bell.

## 2. Chrome extension

A stub extension lives in [`extensions/web-clipper`](../extensions/web-clipper/).
Load it via `chrome://extensions/` → Developer mode → Load unpacked. On
first run it asks for your FlowSpace URL + API token; the toolbar
button posts the current tab.

This is intentionally minimal — feature parity with the bookmarklet
plus the convenience of "no copy-pasting URLs". A polished Web Store
submission is a follow-up.

/**
 * FlowSpace inbound-email forwarder — a Cloudflare Email Worker.
 *
 * Cloudflare Email Routing delivers each incoming message to this worker.
 * We parse the raw MIME with postal-mime and POST the fields FlowSpace
 * wants to its inbound webhook, authenticated with a shared secret. The
 * recipient address (`message.to`, e.g. admin@your-domain) is what
 * FlowSpace uses to route the mail to the right user (local part ==
 * username).
 *
 * Configure in the Cloudflare dashboard (Worker → Settings → Variables),
 * or via wrangler:
 *   FLOWSPACE_WEBHOOK  plain var  e.g. https://flowspace.tashkeelh.com/api/email/inbound
 *   INBOUND_SECRET     SECRET     must equal EMAIL_INBOUND_SECRET on the VM
 *                                 (npx wrangler secret put INBOUND_SECRET)
 */

import PostalMime from "postal-mime"

export default {
  /** @param {ForwardableEmailMessage} message */
  async email(message, env) {
    // Parse the raw MIME into structured fields. arrayBuffer() works across
    // all postal-mime versions (it also accepts the raw stream directly).
    const raw = await new Response(message.raw).arrayBuffer()
    const email = await new PostalMime().parse(raw)

    const payload = {
      to: message.to,                         // routes to the FlowSpace user
      from: message.from,                     // sender address
      subject: email.subject ?? "",
      text: email.text ?? "",
      html: email.html ?? "",
    }

    const webhook =
      env.FLOWSPACE_WEBHOOK ||
      "https://flowspace.tashkeelh.com/api/email/inbound"

    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbound-Secret": env.INBOUND_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      // Bounce so the sender + Cloudflare logs surface the failure instead
      // of silently dropping mail.
      const body = await res.text().catch(() => "")
      message.setReject(
        `FlowSpace webhook ${res.status}: ${body.slice(0, 120) || "rejected"}`,
      )
    }
  },
}

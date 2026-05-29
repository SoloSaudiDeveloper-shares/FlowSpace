# Microsoft Teams integration — feasibility study

**Status:** research only. No code yet. Decide before sprinting.

## TL;DR

Yes, doable, but the surface area is bigger than Telegram and it has a
recurring per-bot cost on the Microsoft side. Three integration paths,
in order of effort:

| Path | Effort | Cost | Best for |
|------|--------|------|----------|
| Incoming webhook | 1 day | $0 | One-way pushes to a Teams channel ("daily digest", "task done") |
| Workflow bot via Power Automate | 3-5 days | Microsoft 365 tenant required | Approval flows, one-tap actions from a channel |
| Full conversational bot (Bot Framework) | 2-3 weeks | Azure Bot Service ($) + Bot Channels Registration | Mirror everything the Telegram bot does today |

## What the user actually wants

The user has Telegram working end-to-end. The question is whether
**Teams** can do the same things — texting the bot to capture a thought,
asking for `/tasks`, getting the morning digest, etc.

If "the same things" means **bi-directional bot like Telegram**, we
need path #3 — Bot Framework.

If "anywhere I can paste a thought into the company chat and it lands in
FlowSpace" is enough, path #1 is fine and ships in a day.

## Path 1: Incoming webhook (recommended starting point)

Microsoft Teams supports incoming webhooks per-channel. The user creates
a webhook URL, pastes it into FlowSpace settings, and FlowSpace can POST
adaptive cards (rich messages) to that channel.

**Capabilities:**
- One-way: FlowSpace → Teams
- Adaptive cards with buttons, but button taps open the URL in a
  browser; Teams can't post the result back to FlowSpace without a bot.
- No threading, no @mentions of FlowSpace.

**Implementation sketch:**

```ts
// src/lib/teams/webhook.ts
export async function postToTeams(webhookUrl: string, card: AdaptiveCard) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  })
  return res.ok
}
```

UI: add a "Teams webhook URL" field to each user's preferences (same
spot as Telegram token). Reuse the bot-reply-templates module to render
adaptive-card JSON.

## Path 2: Power Automate "approve" flow

Microsoft 365 Power Automate (formerly Flow) can poll FlowSpace via an
HTTPS GET, then post approval cards into Teams. When the user taps an
action, Power Automate calls back to FlowSpace. This works *without* an
Azure Bot Service subscription.

**Capabilities:**
- Two-way for a narrow set of approval flows
- Limited message richness
- Requires the org admin to enable Power Automate, plus per-user license
  in some plans

**Effort:** 3-5 days mostly spent in the Power Automate UI building the
flow templates — the FlowSpace side is just adding a few API endpoints
to list/approve pending imports.

## Path 3: Bot Framework conversational bot

This is the only path that gets to feature parity with our Telegram
bot — `/tasks`, `/done`, freeform capture, voice notes (with extra
work), inline buttons, etc.

**Capabilities:**
- Full feature parity
- Works in channels and 1:1 chats
- @mentions, replies, threading

**Requirements:**
- Azure subscription (Free tier covers light usage)
- Bot Channels Registration (currently free)
- App registration in Azure AD
- Microsoft App ID + secret
- HTTPS endpoint (we already have Caddy)

**Effort:** Most of the code we already wrote for Telegram has a
parallel here:
- Webhook receiver → `/api/teams/webhook` (Bot Framework messages)
- `dispatchMessage` translation layer reusing the same intent logic
- Adaptive Card responses instead of MarkdownV2

Estimated 2-3 weeks for one developer.

**Notable gotchas:**
- Microsoft requires you to publish the bot through their store for
  some channels (channel-specific). 1:1 chats are easier.
- Bot Framework Emulator runs locally but the actual webhook needs an
  HTTPS URL Microsoft can reach.
- Teams strips most markdown; you compose with Adaptive Cards instead.

## Recommendation

**Ship path 1 first.** It's a few hours of work and unblocks the user
who actually wanted "I can push a daily digest into a Teams channel".

Revisit path 3 if there's real demand for `/tasks` from inside Teams.
The Telegram bot already covers the mobile-capture use case for users
who'd otherwise want a Teams bot for that.

## Open questions for the user

- Do you have an Azure subscription? (Required for path 3.)
- Is this for a single tenant or for any FlowSpace user to wire up?
- Is one-way push enough, or do you need to *interact* with the bot
  from Teams?

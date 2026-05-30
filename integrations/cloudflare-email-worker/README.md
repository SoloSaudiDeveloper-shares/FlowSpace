# FlowSpace inbound email → Cloudflare Email Worker

Receive email at your domain (e.g. `admin@tashkeelh.com`) and have it land in
your FlowSpace **bell** as a pending item, for free, using Cloudflare Email
Routing + a tiny Worker.

**Cost:** free. Email Routing is unlimited; Workers free tier is 100k
requests/day.

---

## One-time setup

You'll do this from your computer (needs Node, which you already have) and the
Cloudflare dashboard. `tashkeelh.com` is already on Cloudflare, so this is quick.

### 1. Pick a shared secret

This secret authenticates the Worker → FlowSpace call. Generate one (or make up
a long random string):

```bash
openssl rand -hex 24
```

Copy the value — you'll paste it in **two** places (steps 3 and 5).

### 2. Deploy the Worker

```bash
cd integrations/cloudflare-email-worker
npm install
npx wrangler login          # opens your browser to authorize Cloudflare (your account)
npx wrangler deploy
```

> If your domain isn't `flowspace.tashkeelh.com`, edit `FLOWSPACE_WEBHOOK` in
> `wrangler.toml` first.

### 3. Give the Worker the secret

```bash
npx wrangler secret put INBOUND_SECRET
# paste the value from step 1 when prompted
```

### 4. Route mail to the Worker (Cloudflare dashboard)

1. Cloudflare dashboard → select **tashkeelh.com** → **Email** → **Email Routing**.
2. Enable it if you haven't — Cloudflare adds the needed MX records automatically.
3. **Routes** → either:
   - **Custom address**: `admin@tashkeelh.com` → Action: **Send to a Worker** →
     `flowspace-email-forwarder`, **or**
   - **Catch-all address**: Action **Send to a Worker** → `flowspace-email-forwarder`
     (forwards everything `@tashkeelh.com`).

> The local part of the address must match a FlowSpace **username**
> (`admin@…` → user `admin`). Unknown recipients are silently ignored.

### 5. Set the same secret on the VM

SSH into the VM and add the matching secret, then recreate the container so it
picks up the new env (a plain `docker restart` does **not** re-read the env file):

```bash
echo 'EMAIL_INBOUND_SECRET=PASTE_THE_SAME_VALUE_FROM_STEP_1' >> ~/.flowspace.env

sudo docker rm -f flowspace
sudo docker run -d --name flowspace --restart unless-stopped \
  -p 3737:3000 -v flowspace_data:/data \
  --env-file ~/.flowspace.env flowspace:latest
```

---

## Test it

Send an email to `admin@tashkeelh.com`. Within a few seconds a new **pending
item** should appear in your FlowSpace bell — approve it to turn it into a todo,
or dismiss it.

If nothing arrives:
- Cloudflare dashboard → Workers → `flowspace-email-forwarder` → **Logs** (live
  tail) shows each delivery and any error.
- A `401` in the logs means the `INBOUND_SECRET` (Worker) and
  `EMAIL_INBOUND_SECRET` (VM) don't match.
- A `200 accepted: 0` means the recipient local part didn't match any username.

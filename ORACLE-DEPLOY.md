# Deploying FlowSpace to Oracle Cloud Always Free

End-to-end guide for hosting FlowSpace on a free-forever Oracle Cloud
ARM VM. About 30 minutes total, 90% of which is Oracle's signup flow.

## What you get
- A real, public URL accessible from anywhere
- 4 OCPU / 24 GB RAM ARM VM (way more than this app needs)
- 200 GB block storage
- Free forever (Oracle's Always Free tier)

## Cost
**$0/mo**, as long as you stay within Always Free limits (this app uses
<5% of the available resources) and log in to Oracle's console at least
once every ~3 months so they don't reclaim the VM.

---

## Part 1 — Get a GitHub repo (5 min)

The VM needs to clone the code from somewhere.

1. Create a new repo at https://github.com/new
   - Name: `flowspace` (or whatever you like)
   - Privacy: Private is fine — the VM will clone it via HTTPS
   - Don't initialize with README — you're pushing existing code
2. Copy the repo URL (e.g. `https://github.com/YOU/flowspace.git`)
3. From your project directory on Windows:
   ```bash
   git remote add origin https://github.com/YOU/flowspace.git
   git push -u origin master
   ```
   (Git Bash will prompt you to sign in via your browser the first time.)

## Part 2 — Provision the Oracle VM (15 min)

1. Sign up at https://www.oracle.com/cloud/free/
   - Yes, they ask for a credit card. They use it for identity
     verification only. Always Free resources cannot be charged.
   - Pick a home region close to you (this is permanent, choose carefully).

2. From the Oracle console → **Compute → Instances → Create Instance**:
   - Name: `flowspace`
   - Image: **Canonical Ubuntu 22.04** (the ARM build)
   - Shape: **Ampere → VM.Standard.A1.Flex** → 2 OCPUs, 8 GB RAM
     (well within Always Free; you can go up to 4 OCPU / 24 GB free)
   - Networking: default VCN is fine; assign a public IPv4
   - **SSH keys**: click "Generate a key pair for me" and **download both**
     the public and private key files. You'll need the private key.
   - Click **Create**. Wait ~1 min for the instance to show as RUNNING.
   - Copy the **Public IP Address** from the instance details page.

3. Open the firewall:
   - From the instance page → click the VCN name → **Security Lists** →
     **Default Security List** → **Add Ingress Rule**:
     - Source CIDR: `0.0.0.0/0`
     - Destination port: `3737`
     - Description: "FlowSpace HTTP"
     - Save
   - (Add the same for `80` and `443` if you'll set up a domain later.)

## Part 3 — SSH in and run the installer (10 min)

From your Windows machine, in Git Bash or PowerShell:

```bash
# Make sure the key has correct permissions (PowerShell only)
icacls .\ssh-key-2026-05-27.key /inheritance:r /grant:r "$($env:USERNAME):R"

# SSH using the private key Oracle gave you
ssh -i path\to\ssh-key-XXXX.key ubuntu@<YOUR-VM-PUBLIC-IP>
```

Once you're inside the VM:

```bash
# Download and run the one-shot installer
curl -sSL https://raw.githubusercontent.com/YOU/flowspace/master/scripts/oracle-deploy.sh \
  -o oracle-deploy.sh
chmod +x oracle-deploy.sh
./oracle-deploy.sh https://github.com/YOU/flowspace.git
```

The script will:
1. Install Docker
2. Open firewall ports (in the VM's iptables — different from the Oracle
   Security List rule you already added)
3. Clone your repo
4. Build the Docker image (~5 min the first time)
5. Start the container with a persistent `/data` volume
6. Set up a systemd unit so it survives reboots

When it finishes, you'll see:
```
✓ FlowSpace is now running.
  Public URL: http://<your-ip>:3737
```

Open that URL in your browser.

## Part 4 — First-time login

The deployed instance has a fresh empty DB. You need to create the
owner account. Two options:

**A) Use the in-app signup** (if you've left signup enabled — check
`src/app/login/page.tsx`).

**B) Run the bootstrap script inside the container:**
```bash
ssh -i path/to/key ubuntu@<your-ip>
sudo docker exec -it flowspace node scripts/bootstrap-admin.mjs
```
That creates an `admin` user — same flow as desktop.

## Part 4.5 — (Optional) Enable password reset emails via Gmail

Without this, the password-reset flow renders but the email never sends.
The UI warns you about that visibly, so it's safe to skip until you want it.

### Get a Gmail App Password
1. Make sure 2-Step Verification is on for your Google account.
2. Visit https://myaccount.google.com/apppasswords
3. Pick "Mail" / "Other (Custom name)" → name it "FlowSpace" → generate.
4. Copy the 16-character password Google shows you (it's only shown once).

### Put credentials on the VM

```bash
ssh -i path/to/key ubuntu@<your-ip>
cat > ~/.flowspace.env <<EOF
GMAIL_USER=your.address@gmail.com
GMAIL_APP_PASSWORD=the16characterapppwd
PUBLIC_APP_URL=http://<your-ip>:3737
MAIL_FROM_NAME=FlowSpace
EOF
chmod 600 ~/.flowspace.env
```

### Apply

```bash
./oracle-deploy.sh https://github.com/SoloSaudiDeveloper-shares/FlowSpace.git
```

The installer detects `~/.flowspace.env` and passes it into the container as
`--env-file`. The forgot-password / reset-password pages now send real emails.

If you later set up HTTPS + a domain (Part 5), update `PUBLIC_APP_URL` in
`~/.flowspace.env` to your `https://...` URL so the links in emails point
to the right place.

## Part 4.7 — (Optional) Enable "Continue with Google" sign-in

Without these env vars the Google button is hidden. The username/password flow still works.

### Create a Google OAuth client
1. Go to https://console.cloud.google.com/ and create a project (or pick one).
2. Sidebar → **APIs & Services → OAuth consent screen**.
   - User type: External (anyone with a Google account)
   - Fill in app name, support email, developer email — that's enough for now
   - Add scopes: `openid`, `email`, `profile`
   - Add a test user (your own Google email) if you keep the app in "Testing"
3. Sidebar → **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: "FlowSpace"
   - **Authorized JavaScript origins**: `http://145.241.153.186:3737` (no trailing slash)
   - **Authorized redirect URIs**: `http://145.241.153.186:3737/api/auth/google/callback`
   - Copy the **Client ID** and **Client secret** Google gives you.

### Put credentials on the VM
Append to `~/.flowspace.env`:
```
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-yyyyyyyyyyyyyyyy
```

Then re-deploy:
```bash
./oracle-deploy.sh https://github.com/SoloSaudiDeveloper-shares/FlowSpace.git
```

### How signups interact with the "signups closed" toggle
- Owner toggle = closed → Google sign-in works for **existing** users only.
  New Google emails get bounced with "Signups are closed. Ask the owner for an invite."
- Owner toggle = open → Anyone with a Google account can sign in; on first
  sign-in they get a fresh local user (role "editor") and their own workspace.
- An existing local user with a matching email gets their Google account
  silently **linked** on their first Google sign-in. From then on either
  method works.

### Moving to a custom domain
If you set up Caddy + HTTPS (Part 5), update both:
- Google Cloud Console → your OAuth client → swap the URLs to the new domain
- `~/.flowspace.env` → bump `PUBLIC_APP_URL` to the new origin

## Part 5 — (Optional) HTTPS + a domain

For a real domain like `flowspace.yourname.com`:

```bash
# On the VM
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
flowspace.yourname.com {
  reverse_proxy localhost:3737
}
EOF
sudo systemctl restart caddy
```

Caddy gets you a Let's Encrypt certificate automatically. Point your
domain's A record at the VM's public IP and that's it.

## Updating later

Every time you `git push` to GitHub from your Windows machine, the VM
needs to pull and rebuild:

```bash
ssh -i path/to/key ubuntu@<your-ip>
./oracle-deploy.sh https://github.com/YOU/flowspace.git
```

That re-runs the installer, which pulls the latest commit, rebuilds the
image, and restarts the container. Your data persists because it lives
on the Docker volume, separate from the image.

## Troubleshooting

- **Page not loading**: check the Oracle Security List ingress rule for
  port 3737. The VM's local iptables AND the Oracle network ACL both
  need to allow it.
- **`docker: command not found` after install**: log out and back in, or
  run `newgrp docker`. The user-group change needs a new shell.
- **VM reclaimed**: Oracle reclaims Always Free instances after ~7 days
  of inactivity. Log in to the Oracle console every couple months to
  prevent this.
- **Container won't start**: `sudo docker logs flowspace` shows the
  Next.js logs. If `better-sqlite3` failed to build, ensure you're on
  ARM Ubuntu 22.04 (not 20.04, which has an older glibc).

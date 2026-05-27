# Deploying FlowSpace

FlowSpace is local-first SQLite. To host it on a platform with persistent
disk (Railway / Fly / Render), point `DATA_DIR` at the mounted volume.

## Quick choice
- **Railway** — easiest, ~5 minutes if you have a GitHub repo. See below.
- **Fly.io** — flyctl-driven. See `fly.io` section.
- **Render** — web UI similar to Railway. See `render.com` section.

---

## Railway

### Prerequisites
- A GitHub repo containing this codebase
- A Railway account (free tier works for testing; ~$5/mo hobby for production)

### Steps
1. Push this repo to GitHub if it isn't already:
   ```bash
   gh repo create flowspace --private --source=. --push
   ```
2. Go to https://railway.app/new → "Deploy from GitHub repo" → pick the repo.
3. Railway auto-detects the Dockerfile and builds it. Wait for the first
   build (~3–5 min).
4. In the project → **Variables**, set:
   - `DATA_DIR=/data`
   - `NODE_ENV=production`
   - `PORT=3000` (Railway sets this anyway)
5. In **Settings → Volumes**, create a new volume:
   - Mount path: `/data`
   - Size: 1 GB is plenty to start
6. Click **Deploy**. After redeploy, go to **Settings → Networking** and
   click **Generate Domain** to get a public URL.
7. Open the URL. First request bootstraps the database. You'll need to
   create an owner account through the in-app setup (or insert one via
   `scripts/bootstrap-admin.mjs` — see Notes below).

### Updating
Every push to `main` triggers a new build. Your data persists across
deploys because it lives on the volume.

---

## Fly.io

### Prerequisites
- `flyctl` installed locally
- Run `fly auth login`

### Steps
```bash
fly launch --no-deploy
# Choose: yes for Dockerfile, decline managed Postgres
fly volumes create flowspace_data --size 1 --region <your-region>
```
Edit `fly.toml` to add the mount:
```toml
[mounts]
  source = "flowspace_data"
  destination = "/data"

[env]
  DATA_DIR = "/data"
  NODE_ENV = "production"
```
Then:
```bash
fly deploy
```

---

## Render

1. https://render.com/ → New → Web Service → connect GitHub repo.
2. Environment: **Docker** (auto-detected).
3. Add a **Disk** (Settings → Disks): mount at `/data`, 1 GB.
4. Add env var `DATA_DIR=/data`.
5. Click Create. Render handles the rest.

---

## Notes

### Bootstrapping an owner account on the deployed instance
If the app needs an initial owner, SSH/exec into the container and run:
```bash
node scripts/bootstrap-admin.mjs
```
Or seed the user directly via SQL if the platform has a console.

### Backups
The `data/backups/` directory inside the volume holds local snapshots
created by `scripts/backup-data.mjs`. For platform-level snapshots, use
Railway/Fly/Render's volume snapshot features.

### Memory & CPU
- Idle: ~80 MB RAM
- Under typical load: ~150 MB
- Recommended: 512 MB instance, shared CPU. Scales to a few hundred
  concurrent users on that footprint.

#!/usr/bin/env bash
#
# One-shot installer for FlowSpace on an Oracle Cloud Always-Free ARM VM
# (Ubuntu 22.04 or 24.04). Run as the default `ubuntu` user.
#
# What it does:
#   1. Installs Docker
#   2. Opens firewall ports 80 and 443 (and 3737 fallback)
#   3. Clones the repo (or pulls latest)
#   4. Builds the Docker image
#   5. Creates a persistent volume + starts the container
#   6. Sets up systemd so it survives reboots
#
# Re-runnable: rerunning pulls latest code and rebuilds.
#
# Usage:
#   curl -sSL <raw-url-to-this-script> | bash -s -- <github-repo-url>
#   OR
#   bash oracle-deploy.sh https://github.com/you/flowspace.git

set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="$HOME/flowspace"
DATA_VOLUME="flowspace_data"
CONTAINER_NAME="flowspace"
IMAGE_NAME="flowspace:latest"
PORT_HOST=3737

if [ -z "$REPO_URL" ] && [ ! -d "$APP_DIR" ]; then
  echo "Usage: $0 <github-repo-url>"
  echo "  e.g. $0 https://github.com/yourname/flowspace.git"
  exit 1
fi

echo "==> [1/6] Installing prerequisites (docker, git)"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg git
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi

echo "==> [2/6] Opening firewall ports (Oracle Cloud iptables rules persist via netfilter-persistent)"
# Oracle Cloud's Ubuntu image ships with restrictive iptables. Allow our ports.
sudo iptables -I INPUT 1 -p tcp --dport 80   -j ACCEPT  || true
sudo iptables -I INPUT 1 -p tcp --dport 443  -j ACCEPT  || true
sudo iptables -I INPUT 1 -p tcp --dport "$PORT_HOST" -j ACCEPT || true
if ! dpkg -l netfilter-persistent >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi
sudo netfilter-persistent save || true

echo "==> [3/6] Cloning / updating repo at $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> [4/6] Building Docker image (this takes ~5 min the first time)"
sudo docker build -t "$IMAGE_NAME" .

echo "==> [5/6] Creating volume + (re)starting container"
sudo docker volume create "$DATA_VOLUME" >/dev/null
if sudo docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  sudo docker rm -f "$CONTAINER_NAME"
fi
sudo docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${PORT_HOST}:3000" \
  -v "${DATA_VOLUME}:/data" \
  "$IMAGE_NAME"

echo "==> [6/6] Wiring systemd hook (so reboots restart the container)"
sudo tee /etc/systemd/system/flowspace.service > /dev/null <<EOF
[Unit]
Description=FlowSpace personal productivity app
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start ${CONTAINER_NAME}
ExecStop=/usr/bin/docker stop ${CONTAINER_NAME}

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable flowspace.service

PUBLIC_IP=$(curl -s ifconfig.me || echo "<your-vm-public-ip>")
cat <<EOF

================================================================
  ✓ FlowSpace is now running.

  Local check:  curl http://localhost:${PORT_HOST}
  Public URL:   http://${PUBLIC_IP}:${PORT_HOST}

  Next steps:
    1. In the Oracle Cloud console → Networking → VCN → your VCN →
       Security List → add an ingress rule for TCP port ${PORT_HOST}
       from source 0.0.0.0/0 (or your home IP for safety).
    2. Open http://${PUBLIC_IP}:${PORT_HOST} in your browser.
    3. If you want HTTPS + a domain name, install caddy:
         sudo apt-get install -y caddy
         (then edit /etc/caddy/Caddyfile to reverse-proxy to :${PORT_HOST})

  Update later by re-running this script — it'll pull, rebuild, and restart.
================================================================
EOF

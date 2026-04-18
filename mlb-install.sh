#!/usr/bin/env bash
# Dugout MLB Tracker - install / update script for Proxmox LXC (CT 130).
# Idempotent: safe to re-run. Pulls fresh files from GitHub, restarts service.
#
# Usage (fresh install, run inside LXC as root):
#   bash <(curl -fsSL https://raw.githubusercontent.com/qbeaubouef/baseball/main/mlb-install.sh)
#
# Or update in-place after pushing to GitHub:
#   systemctl stop baseball && bash /opt/baseball/mlb-install.sh && systemctl start baseball

set -euo pipefail

# ---------- config ----------
APP_NAME="baseball"
APP_DIR="/opt/${APP_NAME}"
APP_USER="baseball"
SERVICE_NAME="baseball"
NODE_MAJOR="20"
GH_USER="qbeaubouef"
GH_REPO="baseball"
GH_BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${GH_USER}/${GH_REPO}/${GH_BRANCH}"

PORT="${PORT:-3000}"
USER_PIN="${USER_PIN:-4406}"
ADMIN_PIN="${ADMIN_PIN:-5502}"

# Files to sync from GitHub raw (relative paths must match repo structure)
FILES=(
  "server.js"
  "index.html"
  "styles-v2.css"
  "app.jsx"
  "package.json"
  "team_colors_corrected_v3.csv"
  "components/PinGate.jsx"
  "components/Scoreboard.jsx"
  "components/Standings.jsx"
)

# ---------- pretty logging ----------
ts() { date +"%H:%M:%S"; }
log()  { echo -e "\033[1;34m[$(ts)]\033[0m $*"; }
warn() { echo -e "\033[1;33m[$(ts)] WARN:\033[0m $*"; }
err()  { echo -e "\033[1;31m[$(ts)] ERROR:\033[0m $*" >&2; }

# ---------- sanity ----------
if [[ $EUID -ne 0 ]]; then
  err "run as root (sudo bash $0)"
  exit 1
fi

# ---------- packages ----------
ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local current
    current="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "$current" -ge "$NODE_MAJOR" ]]; then
      log "node v$(node -v | sed 's/v//') already installed"
      return
    fi
    log "existing node is too old (v$current), upgrading to $NODE_MAJOR.x"
  else
    log "installing Node.js ${NODE_MAJOR}.x"
  fi
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates gnupg
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
  log "node $(node -v) installed"
}

ensure_packages() {
  log "ensuring base packages (curl, git)"
  apt-get update -qq
  apt-get install -y -qq curl git
}

# ---------- user + dir ----------
ensure_user_dir() {
  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    log "creating system user $APP_USER"
    useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
  fi
  mkdir -p "$APP_DIR/components"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

# ---------- fetch files from GitHub raw ----------
fetch_files() {
  log "fetching files from ${RAW_BASE}"
  local rc=0
  for f in "${FILES[@]}"; do
    local dest="$APP_DIR/$f"
    mkdir -p "$(dirname "$dest")"
    if curl -fsSL -o "$dest.new" "${RAW_BASE}/${f}"; then
      mv "$dest.new" "$dest"
      echo "  ok    $f"
    else
      rm -f "$dest.new"
      if [[ "$f" == "team_colors_corrected_v3.csv" ]]; then
        warn "optional file not in repo: $f (server will fall back to built-in colors)"
      else
        err "could not fetch $f from ${RAW_BASE}/${f}"
        rc=1
      fi
    fi
  done
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  return $rc
}

# ---------- npm install ----------
npm_install() {
  log "installing node dependencies"
  cd "$APP_DIR"
  # Run as the app user so lockfile ownership is correct
  sudo -u "$APP_USER" -H HOME="$APP_DIR" npm install --omit=dev --no-fund --no-audit --loglevel=error
}

# ---------- systemd service ----------
install_service() {
  log "writing systemd unit"
  cat >"/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Dugout MLB Tracker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=USER_PIN=${USER_PIN}
Environment=ADMIN_PIN=${ADMIN_PIN}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=yes
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}.service" >/dev/null
}

# ---------- restart + health check ----------
restart_and_check() {
  log "restarting service"
  systemctl restart "${SERVICE_NAME}.service"
  sleep 2
  if ! systemctl is-active --quiet "${SERVICE_NAME}.service"; then
    err "service failed to start. recent logs:"
    journalctl -u "${SERVICE_NAME}.service" -n 30 --no-pager || true
    exit 1
  fi

  local tries=10
  until curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; do
    tries=$((tries - 1))
    if [[ $tries -le 0 ]]; then
      err "health check failed on port ${PORT}"
      journalctl -u "${SERVICE_NAME}.service" -n 20 --no-pager || true
      exit 1
    fi
    sleep 1
  done
  log "health check ok (port ${PORT})"
}

# ---------- main ----------
main() {
  log "starting install/update for ${APP_NAME}"
  ensure_packages
  ensure_node
  ensure_user_dir
  fetch_files
  npm_install
  install_service
  restart_and_check
  log "done. service: systemctl status ${SERVICE_NAME}"
  log "      logs:    journalctl -u ${SERVICE_NAME} -f"
}

main "$@"

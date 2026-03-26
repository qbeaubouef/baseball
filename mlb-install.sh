#!/usr/bin/env bash

# Copyright (c) 2026 qbeaubouef
# License: MIT
# https://github.com/qbeaubouef/baseball

function header_info {
  clear
  cat <<"EOF"
    __  _____    ____       ____            __    __                         __
   /  |/  / /   / __ )     / __ \____ ___  / /_  / /_  ____  ____ __________/ /
  / /|_/ / /   / __  |    / / / / __ `/ / / / / / __ \/ __ \/ __ `/ ___/ __  / 
 / /  / / /___/ /_/ /    / /_/ / /_/ / /_/ / / / /_/ / /_/ / /_/ / /  / /_/ /  
/_/  /_/_____/_____/    /_____/\__,_/\__,_/ /_/_.___/\____/\__,_/_/   \__,_/   

                    ⚾  Self-hosted MLB Dashboard  ⚾
EOF
}

# ── Colors & helpers ──
YW=$(echo "\033[33m")
GN=$(echo "\033[1;92m")
RD=$(echo "\033[01;31m")
BL=$(echo "\033[36m")
CL=$(echo "\033[m")
BFR="\\r\\033[K"
HOLD=" "
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"
TAB="  "

function msg_info() { local msg="$1"; echo -ne "${TAB}${HOLD}${YW}${msg}...${CL}"; }
function msg_ok() { local msg="$1"; echo -e "${BFR}${TAB}${CM} ${GN}${msg}${CL}"; }
function msg_error() { local msg="$1"; echo -e "${BFR}${TAB}${CROSS} ${RD}${msg}${CL}"; exit 1; }

# ── Checks ──
if [ "$(id -u)" -ne 0 ]; then
  msg_error "This script must be run as root"
fi

if ! command -v pveversion &>/dev/null; then
  msg_error "This script must be run on a Proxmox VE host"
fi

header_info
echo -e "\n${TAB}This will create an LXC container running the MLB Dashboard."
echo -e "${TAB}${BL}Requires: Proxmox VE 7+ with a Debian/Ubuntu CT template.${CL}\n"

# ── Storage detection ──
function select_storage() {
  local storages
  storages=$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 {print $1}')
  if [[ -z "$storages" ]]; then
    msg_error "No storage found with 'rootdir' content type."
  fi
  local count
  count=$(echo "$storages" | wc -w)
  if [[ "$count" -eq 1 ]]; then
    STORAGE="$storages"
  else
    echo -e "\n${TAB}Available storage pools:"
    local i=1
    for s in $storages; do
      echo -e "${TAB}  ${GN}${i})${CL} $s"
      ((i++))
    done
    echo ""
    read -rp "${TAB}Select storage (number): " choice
    STORAGE=$(echo "$storages" | sed -n "${choice}p")
    if [[ -z "$STORAGE" ]]; then
      msg_error "Invalid storage selection"
    fi
  fi
}

# ── Template detection ──
function select_template() {
  local templates
  templates=$(pveam list "$STORAGE" 2>/dev/null | grep -E "debian-12|ubuntu-2[24]" | awk '{print $1}' | head -5)
  if [[ -z "$templates" ]]; then
    echo -e "\n${TAB}${YW}No Debian/Ubuntu template found. Downloading debian-12...${CL}"
    pveam download "$STORAGE" debian-12-standard_12.7-1_amd64.tar.zst 2>/dev/null
    templates=$(pveam list "$STORAGE" 2>/dev/null | grep "debian-12" | awk '{print $1}' | head -1)
  fi
  local count
  count=$(echo "$templates" | wc -w)
  if [[ "$count" -eq 1 ]]; then
    TEMPLATE="$templates"
  else
    echo -e "\n${TAB}Available templates:"
    local i=1
    for t in $templates; do
      echo -e "${TAB}  ${GN}${i})${CL} $t"
      ((i++))
    done
    echo ""
    read -rp "${TAB}Select template (number): " choice
    TEMPLATE=$(echo "$templates" | sed -n "${choice}p")
    if [[ -z "$TEMPLATE" ]]; then
      msg_error "Invalid template selection"
    fi
  fi
}

# ── Defaults ──
CT_ID=$(pvesh get /cluster/nextid 2>/dev/null)
HN="baseball"
DISK_SIZE="2"
RAM="512"
CORES="1"
BRIDGE="vmbr0"
STORAGE=""
TEMPLATE=""

# ── Settings dialog ──
if command -v whiptail &>/dev/null; then
  if whiptail --title "MLB Dashboard LXC" --yesno "Use default settings?\n\nCT ID: ${CT_ID}\nHostname: ${HN}\nDisk: ${DISK_SIZE}GB\nRAM: ${RAM}MB\nCPU: ${CORES} core(s)\nBridge: ${BRIDGE}" 16 48; then
    ADVANCED=false
  else
    ADVANCED=true
  fi
else
  echo -e "\n${TAB}Default settings:"
  echo -e "${TAB}  CT ID:    ${GN}${CT_ID}${CL}"
  echo -e "${TAB}  Hostname: ${GN}${HN}${CL}"
  echo -e "${TAB}  Disk:     ${GN}${DISK_SIZE}GB${CL}"
  echo -e "${TAB}  RAM:      ${GN}${RAM}MB${CL}"
  echo -e "${TAB}  CPU:      ${GN}${CORES} core(s)${CL}"
  echo -e "${TAB}  Bridge:   ${GN}${BRIDGE}${CL}"
  echo ""
  read -rp "${TAB}Use defaults? [Y/n]: " yn
  ADVANCED=false
  [[ "$yn" =~ ^[Nn] ]] && ADVANCED=true
fi

if $ADVANCED; then
  if command -v whiptail &>/dev/null; then
    CT_ID=$(whiptail --inputbox "Container ID:" 8 48 "$CT_ID" 3>&1 1>&2 2>&3)
    HN=$(whiptail --inputbox "Hostname:" 8 48 "$HN" 3>&1 1>&2 2>&3)
    DISK_SIZE=$(whiptail --inputbox "Disk size (GB):" 8 48 "$DISK_SIZE" 3>&1 1>&2 2>&3)
    RAM=$(whiptail --inputbox "RAM (MB):" 8 48 "$RAM" 3>&1 1>&2 2>&3)
    CORES=$(whiptail --inputbox "CPU cores:" 8 48 "$CORES" 3>&1 1>&2 2>&3)
    BRIDGE=$(whiptail --inputbox "Network bridge:" 8 48 "$BRIDGE" 3>&1 1>&2 2>&3)
  else
    read -rp "${TAB}Container ID [${CT_ID}]: " input; CT_ID=${input:-$CT_ID}
    read -rp "${TAB}Hostname [${HN}]: " input; HN=${input:-$HN}
    read -rp "${TAB}Disk size GB [${DISK_SIZE}]: " input; DISK_SIZE=${input:-$DISK_SIZE}
    read -rp "${TAB}RAM MB [${RAM}]: " input; RAM=${input:-$RAM}
    read -rp "${TAB}CPU cores [${CORES}]: " input; CORES=${input:-$CORES}
    read -rp "${TAB}Network bridge [${BRIDGE}]: " input; BRIDGE=${input:-$BRIDGE}
  fi
fi

# ── Storage & Template ──
select_storage
msg_ok "Storage: ${STORAGE}"
select_template
msg_ok "Template: ${TEMPLATE}"

# ── Create LXC ──
echo ""
msg_info "Creating LXC container ${CT_ID} (${HN})"
pct create "$CT_ID" "${STORAGE}:vztmpl/${TEMPLATE##*/}" \
  --hostname "$HN" \
  --cores "$CORES" \
  --memory "$RAM" \
  --rootfs "${STORAGE}:${DISK_SIZE}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1 \
  --start 0 \
  &>/dev/null
msg_ok "Container ${CT_ID} created"

# ── Start container ──
msg_info "Starting container"
pct start "$CT_ID" &>/dev/null
sleep 3
msg_ok "Container started"

# ── Wait for network ──
msg_info "Waiting for network"
for i in $(seq 1 30); do
  if pct exec "$CT_ID" -- ping -c1 -W1 google.com &>/dev/null; then
    break
  fi
  sleep 1
done
msg_ok "Network ready"

# ── Install Node.js 20 ──
msg_info "Installing Node.js 20"
pct exec "$CT_ID" -- bash -c "
  apt-get update -qq &>/dev/null
  apt-get install -y -qq curl ca-certificates gnupg &>/dev/null
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main' > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq &>/dev/null
  apt-get install -y -qq nodejs &>/dev/null
" &>/dev/null
msg_ok "Node.js $(pct exec "$CT_ID" -- node -v 2>/dev/null) installed"

# ── Deploy app ──
msg_info "Deploying MLB Dashboard"
pct exec "$CT_ID" -- bash -c "
  mkdir -p /opt/baseball/public /data

  REPO='https://raw.githubusercontent.com/qbeaubouef/baseball/main'
  curl -fsSL \"\${REPO}/server.js\" -o /opt/baseball/server.js
  curl -fsSL \"\${REPO}/public/index.html\" -o /opt/baseball/public/index.html
  curl -fsSL \"\${REPO}/team_colors_corrected_v3.csv\" -o /opt/baseball/team_colors_corrected_v3.csv

  cd /opt/baseball
  npm init -y &>/dev/null
  npm install express &>/dev/null
" &>/dev/null
msg_ok "App deployed"

# ── Create systemd service ──
msg_info "Creating systemd service"
pct exec "$CT_ID" -- bash -c "
cat > /etc/systemd/system/baseball.service << 'UNIT'
[Unit]
Description=MLB Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/baseball
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=PIN=4406
Environment=DATA_DIR=/data

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable baseball &>/dev/null
systemctl start baseball
" &>/dev/null
msg_ok "Service created and started"

# ── Get IP ──
sleep 2
IP=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')

# ── Done ──
echo ""
echo -e "${TAB}${GN}══════════════════════════════════════════${CL}"
echo -e "${TAB}${GN}  MLB Dashboard installed successfully!${CL}"
echo -e "${TAB}${GN}══════════════════════════════════════════${CL}"
echo ""
echo -e "${TAB}  Container ID:  ${BL}${CT_ID}${CL}"
echo -e "${TAB}  Hostname:      ${BL}${HN}${CL}"
echo -e "${TAB}  IP Address:    ${BL}${IP}${CL}"
echo -e "${TAB}  Dashboard:     ${BL}http://${IP}:3000${CL}"
echo -e "${TAB}  PIN:           ${BL}4406${CL}"
echo ""
echo -e "${TAB}  Service:       ${YW}systemctl [start|stop|restart] baseball${CL}"
echo -e "${TAB}  Logs:          ${YW}journalctl -u baseball -f${CL}"
echo ""
echo -e "${TAB}  To update team colors:"
echo -e "${TAB}    Edit ${BL}/opt/baseball/team_colors_corrected_v3.csv${CL}"
echo -e "${TAB}    Then: ${YW}curl -X POST http://localhost:3000/api/colors/reload${CL}"
echo ""
echo -e "${TAB}  ${GN}Go Stros. ⚾${CL}"
echo ""

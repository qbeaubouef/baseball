#!/bin/bash
# pve-rundown.sh
# Generates a comprehensive read-only snapshot of a Proxmox VE host.
# Usage:
#   chmod +x pve-rundown.sh
#   ./pve-rundown.sh > rundown.txt 2>&1
#
# Safe to run: this script only reads configuration and status. It does not
# modify any settings, VMs, containers, storage, or networking.

set -u

section() {
  echo ""
  echo "===================================================================="
  echo "===== $1"
  echo "===================================================================="
}

sub() {
  echo ""
  echo "----- $1 -----"
}

section "PROXMOX VERSION"
pveversion -v 2>/dev/null || echo "pveversion not available"

section "HOSTNAME / UPTIME / DATE"
hostname
uptime
date

section "CPU"
lscpu

section "MEMORY"
free -h

section "DISKS"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL,SERIAL
sub "Disk usage"
df -hT -x tmpfs -x devtmpfs -x squashfs 2>/dev/null
sub "SMART health summary"
if command -v smartctl >/dev/null 2>&1; then
  for d in $(lsblk -dno NAME | grep -E '^(sd|nvme|hd)'); do
    echo "### /dev/$d"
    smartctl -H /dev/$d 2>/dev/null | grep -E "SMART overall|result|Model|Serial|Capacity"
  done
else
  echo "smartctl not installed (apt install smartmontools to enable)"
fi

section "ZFS"
if command -v zpool >/dev/null 2>&1; then
  sub "zpool list"
  zpool list 2>/dev/null
  sub "zpool status"
  zpool status 2>/dev/null
  sub "zfs list"
  zfs list 2>/dev/null
  sub "zfs get compression,dedup,recordsize,atime"
  zfs get compression,dedup,recordsize,atime 2>/dev/null
else
  echo "ZFS tools not present"
fi

section "LVM"
sub "Physical volumes"
pvs 2>/dev/null
sub "Volume groups"
vgs 2>/dev/null
sub "Logical volumes"
lvs 2>/dev/null

section "STORAGE CONFIG"
sub "pvesm status"
pvesm status 2>/dev/null
sub "/etc/pve/storage.cfg"
cat /etc/pve/storage.cfg 2>/dev/null

section "NETWORK"
sub "ip -br a"
ip -br a
sub "ip route"
ip route
sub "/etc/network/interfaces"
cat /etc/network/interfaces 2>/dev/null
sub "/etc/network/interfaces.d/"
ls -la /etc/network/interfaces.d/ 2>/dev/null
for f in /etc/network/interfaces.d/*; do
  [ -f "$f" ] && echo "### $f" && cat "$f"
done
sub "Bridges"
if command -v brctl >/dev/null 2>&1; then
  brctl show 2>/dev/null
else
  bridge link 2>/dev/null
fi
sub "/etc/hosts"
cat /etc/hosts 2>/dev/null
sub "/etc/resolv.conf"
cat /etc/resolv.conf 2>/dev/null

section "CLUSTER"
pvecm status 2>/dev/null || echo "Not in a cluster (or pvecm unavailable)"
sub "Nodes"
pvecm nodes 2>/dev/null

section "NODES (API)"
pvesh get /nodes --output-format json 2>/dev/null

section "VMs"
qm list 2>/dev/null
for id in $(qm list 2>/dev/null | awk 'NR>1 {print $1}'); do
  sub "VM $id config"
  qm config "$id" 2>/dev/null
done

section "LXC CONTAINERS"
pct list 2>/dev/null
for id in $(pct list 2>/dev/null | awk 'NR>1 {print $1}'); do
  sub "CT $id config"
  pct config "$id" 2>/dev/null
done

section "GPU / PCI"
sub "Display / GPU devices"
lspci | grep -iE "vga|3d|display|nvidia|amd/ati|intel.*graphics"
sub "All PCI devices"
lspci -nn
sub "IOMMU groups"
if [ -d /sys/kernel/iommu_groups ]; then
  for g in $(find /sys/kernel/iommu_groups/ -maxdepth 1 -mindepth 1 -type d | sort -V); do
    echo "Group ${g##*/}:"
    for d in $g/devices/*; do
      echo -e "\t$(lspci -nns ${d##*/} 2>/dev/null)"
    done
  done
else
  echo "IOMMU not enabled or not exposed"
fi
sub "VFIO / passthrough modules"
lsmod | grep -iE "vfio|nvidia|i915|amdgpu|nouveau" 2>/dev/null
sub "/etc/modprobe.d/ entries"
ls -la /etc/modprobe.d/ 2>/dev/null
for f in /etc/modprobe.d/*.conf; do
  [ -f "$f" ] && echo "### $f" && cat "$f"
done

section "BACKUP JOBS"
sub "/etc/pve/jobs.cfg"
cat /etc/pve/jobs.cfg 2>/dev/null
sub "/etc/vzdump.conf"
cat /etc/vzdump.conf 2>/dev/null
sub "Recent backup logs (last 5)"
ls -lt /var/log/vzdump/ 2>/dev/null | head -6

section "FIREWALL"
sub "Cluster firewall"
cat /etc/pve/firewall/cluster.fw 2>/dev/null
sub "Host firewall"
for f in /etc/pve/nodes/*/host.fw; do
  [ -f "$f" ] && echo "### $f" && cat "$f"
done

section "USERS / AUTH"
sub "User list"
pveum user list 2>/dev/null
sub "Realm list"
pveum realm list 2>/dev/null
sub "Group list"
pveum group list 2>/dev/null

section "SUBSCRIPTION / REPOS"
sub "/etc/apt/sources.list"
cat /etc/apt/sources.list 2>/dev/null
sub "/etc/apt/sources.list.d/"
for f in /etc/apt/sources.list.d/*; do
  [ -f "$f" ] && echo "### $f" && cat "$f"
done

section "KERNEL / BOOT"
uname -a
sub "/proc/cmdline"
cat /proc/cmdline
sub "Installed kernels"
dpkg -l 'pve-kernel-*' 2>/dev/null | grep ^ii
sub "Boot tool"
if [ -d /etc/kernel/proxmox-boot-uuids ] || [ -f /etc/kernel/proxmox-boot-uuids ]; then
  echo "proxmox-boot-tool in use"
  proxmox-boot-tool status 2>/dev/null
else
  echo "GRUB-based boot"
fi

section "SERVICES (key Proxmox)"
for svc in pve-cluster pvedaemon pveproxy pvestatd pve-firewall corosync pbs-proxy pve-ha-lrm pve-ha-crm; do
  status=$(systemctl is-active "$svc" 2>/dev/null)
  enabled=$(systemctl is-enabled "$svc" 2>/dev/null)
  printf "%-20s active=%-10s enabled=%s\n" "$svc" "$status" "$enabled"
done

section "TOP MEMORY CONSUMERS"
ps aux --sort=-%rss | head -20

section "TOP CPU CONSUMERS"
ps aux --sort=-%cpu | head -20

section "TEMPERATURES (if sensors installed)"
if command -v sensors >/dev/null 2>&1; then
  sensors 2>/dev/null
else
  echo "lm-sensors not installed (apt install lm-sensors to enable)"
fi

section "DONE"
echo "Generated: $(date)"
echo "Host: $(hostname)"

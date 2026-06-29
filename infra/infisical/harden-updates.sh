#!/usr/bin/env bash
# Backlog anwenden + unattended-upgrades härten (Security + ESM-Security + Updates, Auto-Reboot 04:30,
# alte Kernel aufräumen). Läuft non-interaktiv; danach Infisical-Health prüfen.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

echo "== Backlog anwenden (dist-upgrade) =="
apt-get update -qq
apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dist-upgrade
apt-get -y --purge autoremove

echo "== unattended-upgrades sicherstellen =="
apt-get -y install unattended-upgrades

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF

cat > /etc/apt/apt.conf.d/52doldenblick-unattended <<'CONF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
    "${distro_id}:${distro_codename}-updates";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::SyslogEnable "true";
CONF

systemctl enable --now unattended-upgrades

echo "== Config-Probelauf (dry-run) =="
unattended-upgrade --dry-run -d 2>&1 | tail -8 || true
echo "== Timer =="
systemctl is-enabled apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true
echo "== verbleibend upgradable =="
apt list --upgradable 2>/dev/null | grep -v "^Listing" | wc -l
echo "== Reboot nötig? =="
test -f /var/run/reboot-required && echo "JA — Pakete: $(cat /var/run/reboot-required.pkgs 2>/dev/null | tr '\n' ' ')" || echo "nein"
echo "== Kernel laufend: $(uname -r) =="
echo "== Infisical-Health nach Upgrade =="
cd /opt/infisical && docker compose ps && curl -s -o /dev/null -w "api/status: %{http_code}\n" http://127.0.0.1:8080/api/status
echo "DONE"

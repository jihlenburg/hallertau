#!/usr/bin/env bash
# Hardening + HTTPS for doldenblick-01 (Ubuntu 24.04). Idempotent where practical.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
APT="apt-get -o DPkg::Lock::Timeout=300 -y"
LE_EMAIL="ihlenburg@ihlems.de"
DOMAINS="-d doldenblick.de -d www.doldenblick.de"

say(){ printf "\n=== %s ===\n" "$*"; }

say "1/8 apt update + packages"
$APT update -qq
$APT install -qq certbot python3-certbot-nginx fail2ban unattended-upgrades >/dev/null

say "2/8 unattended-upgrades (auto security patches)"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

say "3/8 SSH hardening (drop-in; key-only root, validated before restart)"
cat >/etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitEmptyPasswords no
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
MaxAuthTries 3
MaxSessions 6
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
sshd -t && systemctl restart ssh && echo "sshd: config valid, restarted"

say "4/8 fail2ban (sshd jail)"
cat >/etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 4
backend = systemd

[sshd]
enabled = true
mode = aggressive
EOF
systemctl enable --now fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban || true

say "5/8 sysctl network hardening"
cat >/etc/sysctl.d/99-hardening.conf <<'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
EOF
sysctl --system >/dev/null && echo "sysctl applied"

say "6/8 ufw ensure 443 + 80 open, default deny incoming"
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force reload >/dev/null 2>&1 || true
ufw status verbose | sed -n '1,12p'

say "7/8 nginx security headers + server_tokens off"
cat >/etc/nginx/conf.d/00-hardening.conf <<'EOF'
server_tokens off;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
EOF
nginx -t && systemctl reload nginx && echo "nginx: headers loaded"

say "8/8 HTTPS via Let's Encrypt (certbot --nginx, with 80->443 redirect)"
certbot --nginx $DOMAINS --redirect --agree-tos --no-eff-email -m "$LE_EMAIL" --non-interactive
echo "--- certbot renewal timer ---"
systemctl list-timers 'certbot*' --no-pager 2>/dev/null | sed -n '1,3p' || true
echo "--- dry-run renewal test ---"
certbot renew --dry-run 2>&1 | tail -3

say "DONE"

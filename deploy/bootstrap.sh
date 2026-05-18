#!/usr/bin/env bash
# One-shot Hetzner provisioning. Run once as root on a fresh Ubuntu 24.04 box:
#   curl -fsSL https://raw.githubusercontent.com/g-lover10/bfrs-events-staffing/claude/add-hetzner-integration-QSGNr/deploy/bootstrap.sh | sudo bash
# Or copy this file to the box and: sudo bash bootstrap.sh
#
# Idempotent — safe to re-run.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Must run as root (use sudo)." >&2
  exit 1
fi

# --- Derive sslip.io hostname from the box's public IPv4 -----------------------
PUBLIC_IP="$(curl -fsSL https://api.ipify.org)"
HOSTNAME="${PUBLIC_IP//./-}.sslip.io"
echo "==> Public IP: $PUBLIC_IP"
echo "==> Will configure nginx + TLS for: $HOSTNAME"

# --- Base packages -------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg ufw nginx fail2ban rsync

# Node.js 20 (NodeSource)
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# certbot via snap (Let's Encrypt's recommended path on Ubuntu)
apt-get install -y snapd
snap install core || true
snap refresh core || true
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# --- Service user + directory layout -------------------------------------------
id -u bfrs >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin bfrs
install -d -o bfrs -g bfrs -m 0755 /opt/bfrs-api /opt/bfrs-api/releases
install -d -o root -g root -m 0755 /var/www/letsencrypt

# --- Secrets env file (operator fills in real values) --------------------------
if [[ ! -f /etc/bfrs-api.env ]]; then
  cat >/etc/bfrs-api.env <<'EOF'
# Fill in the same values currently set in Netlify -> Site -> Environment variables.
GROQ_KEY=
RESEND_KEY=
SUPABASE_SERVICE_KEY=
EOF
  chown root:bfrs /etc/bfrs-api.env
  chmod 0640 /etc/bfrs-api.env
  echo
  echo "==> Created /etc/bfrs-api.env — edit it now and paste your secrets:"
  echo "    sudo nano /etc/bfrs-api.env"
  echo "    sudo systemctl restart bfrs-api   # after editing"
  echo
fi

# --- systemd unit --------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/bfrs-api.service" ]]; then
  install -m 0644 "$SCRIPT_DIR/bfrs-api.service" /etc/systemd/system/bfrs-api.service
else
  curl -fsSL https://raw.githubusercontent.com/g-lover10/bfrs-events-staffing/claude/add-hetzner-integration-QSGNr/deploy/bfrs-api.service \
    -o /etc/systemd/system/bfrs-api.service
fi
systemctl daemon-reload
systemctl enable bfrs-api

# --- nginx site ----------------------------------------------------------------
if [[ -f "$SCRIPT_DIR/nginx.conf" ]]; then
  sed "s/__HOSTNAME__/$HOSTNAME/g" "$SCRIPT_DIR/nginx.conf" > /etc/nginx/sites-available/bfrs-api
else
  curl -fsSL https://raw.githubusercontent.com/g-lover10/bfrs-events-staffing/claude/add-hetzner-integration-QSGNr/deploy/nginx.conf \
    | sed "s/__HOSTNAME__/$HOSTNAME/g" > /etc/nginx/sites-available/bfrs-api
fi
ln -sf /etc/nginx/sites-available/bfrs-api /etc/nginx/sites-enabled/bfrs-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# --- Firewall ------------------------------------------------------------------
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# --- Let's Encrypt -------------------------------------------------------------
# Non-interactive issuance. Re-running is a no-op if a valid cert already exists.
certbot --nginx --non-interactive --agree-tos \
  --email grabcalls@gmail.com \
  --redirect \
  -d "$HOSTNAME" || {
    echo "!! certbot failed. The API will still serve over HTTP on $HOSTNAME."
    echo "!! Re-run after DNS for $HOSTNAME resolves: sudo certbot --nginx -d $HOSTNAME"
}

echo
echo "==> Bootstrap complete."
echo "==> Hostname:  https://$HOSTNAME"
echo "==> Next step: deploy code with deploy/deploy.sh from your laptop or via the GitHub Action."
echo "==> Then check: curl https://$HOSTNAME/healthz"

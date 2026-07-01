#!/usr/bin/env python3
# DoldenBlick — Secrets-Sync: rendert prod-Secrets aus Infisical in lokale EnvironmentFiles.
# Mehrere Ziele (rs, accounts). FAIL-SAFE pro Ziel: bei Vault-/Netz-Fehler ODER fehlenden Secrets
# eines Ziels wird DESSEN Datei NICHT angefasst (Prod bleibt unbeeinflusst). Restart nur bei Änderung.
# Aufruf:  ... apply   (Default: schreiben + ggf. restart)   |   ... --check  (nur vergleichen)
import os, sys, json, tempfile, subprocess, urllib.request, urllib.error
CREDS = "/etc/doldenblick/infisical-identity"

# Ziele: jede Env-Datei mit ihren benötigten Schlüsseln + zugehörigem systemd-Dienst.
TARGETS = [
    {"target": "/etc/doldenblick/doldenblick-rs.env",
     "keys": ["COPERNICUS_CLIENT_ID", "COPERNICUS_CLIENT_SECRET"],
     "restart": "doldenblick-rs"},
    {"target": "/etc/doldenblick/doldenblick-accounts.env",
     "keys": ["DATABASE_URL", "SESSION_SIGNING_KEY", "RP_ID", "RP_ORIGIN", "SITE_URL", "POSTMARK_SERVER_API_TOKEN"],
     "restart": "doldenblick-accounts"},
]

def load_creds():
    c = {}
    for line in open(CREDS):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); c[k] = v
    return c

def api(addr, method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(addr + path, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)

def fetch_all():
    c = load_creds()
    addr = c.get("INFISICAL_ADDR", "http://10.0.0.2:8080").rstrip("/")
    login = api(addr, "POST", "/api/v1/auth/universal-auth/login",
                {"clientId": c["INFISICAL_CLIENT_ID"], "clientSecret": c["INFISICAL_CLIENT_SECRET"]})
    token = login["accessToken"]; pid = c["INFISICAL_PROJECT_ID"]
    res = api(addr, "GET", f"/api/v3/secrets/raw?workspaceId={pid}&environment=prod&secretPath=%2F", token=token)
    return {s["secretKey"]: s["secretValue"] for s in res.get("secrets", [])}

def render(secrets, keys):
    return "".join(f"{k}={secrets[k]}\n" for k in keys if k in secrets)

def kv(s):
    return dict(l.split("=", 1) for l in s.splitlines() if "=" in l and not l.startswith("#"))

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "apply"
    try:
        all_secrets = fetch_all()
    except Exception as e:
        sys.stderr.write(f"FETCH-FEHLER ({type(e).__name__}) — keine Datei angetastet, Prod unbeeinflusst\n")
        sys.exit(2)
    rc = 0
    for t in TARGETS:
        target, keys, restart = t["target"], t["keys"], t["restart"]
        missing = [k for k in keys if k not in all_secrets]
        if missing:
            sys.stderr.write(f"[{restart}] fehlende Secrets in Infisical: {missing} — {target} unangetastet\n")
            if mode == "--check": rc = 1
            continue
        new = render(all_secrets, keys)
        cur = open(target).read() if os.path.exists(target) else None
        if mode == "--check":
            if cur is None or kv(cur) != kv(new):
                print(f"[{restart}] DIFF/leer: {target}"); rc = 1
            else:
                print(f"[{restart}] MATCH: {target}")
            continue
        if cur == new:
            print(f"[{restart}] unverändert — kein Rewrite/Restart"); continue
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(target), prefix=".env.")
        os.write(fd, new.encode()); os.close(fd); os.chmod(tmp, 0o600); os.replace(tmp, target)
        print(f"[{restart}] EnvironmentFile aktualisiert -> try-restart")
        subprocess.run(["systemctl", "try-restart", restart], check=False)
    sys.exit(rc)

main()

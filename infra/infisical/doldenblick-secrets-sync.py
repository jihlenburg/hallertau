#!/usr/bin/env python3
# DoldenBlick — Secrets-Sync: rendert prod-Secrets aus Infisical in den lokalen EnvironmentFile.
# FAIL-SAFE: bei Vault-/Netz-Fehler oder fehlenden Secrets wird die Zieldatei NICHT angefasst
# (Prod bleibt unbeeinflusst). Restart von doldenblick-rs nur bei tatsächlicher Änderung.
# Aufruf:  ... apply   (Default: schreiben+ggf. restart)   |   ... --check  (nur vergleichen)
import os, sys, json, tempfile, subprocess, urllib.request, urllib.error
CREDS="/etc/doldenblick/infisical-identity"
TARGET="/etc/doldenblick/doldenblick-rs.env"
KEYS=["COPERNICUS_CLIENT_ID","COPERNICUS_CLIENT_SECRET"]
RESTART="doldenblick-rs"

def load_creds():
    c={}
    for line in open(CREDS):
        line=line.strip()
        if "=" in line and not line.startswith("#"):
            k,v=line.split("=",1); c[k]=v
    return c

def api(addr, method, path, body=None, token=None):
    data=json.dumps(body).encode() if body is not None else None
    h={"Content-Type":"application/json"}
    if token: h["Authorization"]="Bearer "+token
    req=urllib.request.Request(addr+path, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)

def fetch():
    c=load_creds()
    addr=c.get("INFISICAL_ADDR","http://10.0.0.2:8080").rstrip("/")
    login=api(addr,"POST","/api/v1/auth/universal-auth/login",
              {"clientId":c["INFISICAL_CLIENT_ID"],"clientSecret":c["INFISICAL_CLIENT_SECRET"]})
    token=login["accessToken"]; pid=c["INFISICAL_PROJECT_ID"]
    res=api(addr,"GET",f"/api/v3/secrets/raw?workspaceId={pid}&environment=prod&secretPath=%2F",token=token)
    secs={s["secretKey"]:s["secretValue"] for s in res.get("secrets",[])}
    return {k:secs[k] for k in KEYS if k in secs}

def render(secrets):
    return "".join(f"{k}={secrets[k]}\n" for k in KEYS if k in secrets)

def kv(s):
    return dict(l.split("=",1) for l in s.splitlines() if "=" in l and not l.startswith("#"))

def main():
    mode = sys.argv[1] if len(sys.argv)>1 else "apply"
    try:
        secrets=fetch()
    except Exception as e:
        sys.stderr.write(f"FETCH-FEHLER ({type(e).__name__}) — Zieldatei unangetastet, Prod unbeeinflusst\n")
        sys.exit(2)
    missing=[k for k in KEYS if k not in secrets]
    if missing:
        sys.stderr.write(f"FEHLENDE Secrets in Infisical: {missing} — Abbruch, Zieldatei unangetastet\n"); sys.exit(3)
    new=render(secrets)
    cur=open(TARGET).read() if os.path.exists(TARGET) else None
    if mode=="--check":
        if cur is None: print("DIFF: Zieldatei fehlt"); sys.exit(1)
        a,b=kv(cur),kv(new)
        if a==b: print("MATCH — Infisical-Werte == aktueller EnvironmentFile"); sys.exit(0)
        dk=sorted(k for k in set(a)|set(b) if a.get(k)!=b.get(k))
        print("DIFF bei Schlüsseln: "+",".join(dk)); sys.exit(1)
    if cur==new:
        print("unverändert — kein Rewrite/Restart"); sys.exit(0)
    fd,tmp=tempfile.mkstemp(dir="/etc/doldenblick",prefix=".rs-env.")
    os.write(fd,new.encode()); os.close(fd); os.chmod(tmp,0o600); os.replace(tmp,TARGET)
    print(f"EnvironmentFile aktualisiert -> try-restart {RESTART}")
    subprocess.run(["systemctl","try-restart",RESTART],check=False); sys.exit(0)

main()

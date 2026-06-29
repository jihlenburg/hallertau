# Migration nach Claude Code Web (claude.ai/code)

Diese Anleitung beschreibt, wie die **Entwicklung** dieses Repos in eine
Cloud-Umgebung von Claude Code Web umzieht. Es geht ausschließlich um den
Dev-Workflow — **die produktive Seite (`doldenblick-01`) ist davon unberührt**:
Sie hält ihre CDSE-/OWM-/Hetzner-Zugangsdaten in einer root-eigenen
`EnvironmentFile` (s. `infra/`) und läuft weiter, egal wo entwickelt wird.

## Was über Git automatisch mitkommt
Alles im Repo: `app/`, `api/`, `rs/`, `infra/`, `docs/`, `scripts/`,
`CLAUDE.md`, `LOGBOOK.md`, `TODO.md`, `.env.example`. Eine frische Cloud-Session,
die `LOGBOOK.md` + `docs/` + `CLAUDE.md` liest, erbt den vollen Projektkontext.

## Was NICHT über Git mitkommt → in der Cloud bereitstellen
| Sache | lokal | in der Cloud |
|---|---|---|
| 6 Env-Keys (CDSE, OWM, Hetzner, GCS-Bucket, GEE-Pfad) | `.env` (gitignored) | als **Environment-Variablen** |
| GEE-Service-Account-JSON | Datei außerhalb des Repos | als **Env-Var (base64)** + im Setup-Script materialisiert |
| `node_modules` (app/api/rs) | gitignored | `npm ci` im Setup-Script |
| SSH-Deploy-Key | `~/.ssh` | nur falls aus der Cloud deployt wird |
| `deliverables/`, wkhtmltopdf | lokal | per `build.sh` reproduzierbar — nur für PDF/Mockups nötig |

## Schritt für Schritt

### 1. GitHub verbinden & Umgebung anlegen
1. Auf [claude.ai/code](https://claude.ai/code) mit dem Anthropic-Konto anmelden.
2. **Claude-GitHub-App installieren**, Repo-Zugriff gewähren.
3. **Environment anlegen** — im Formular:
   - **Network access**: `Trusted` (Default; deckt npm/PyPI sowie CDSE/GEE-APIs ab).
   - **Environment variables**: die Keys unten (`.env`-Format, **ohne Anführungszeichen**).
   - **Setup script**: `bash scripts/cloud-setup.sh`

Alternativ per CLI: `claude /web-setup` (benötigt authentifizierte `gh`-CLI).

### 2. Environment-Variablen (nicht ins Git!)
Im Feld **Environment variables** im `.env`-Format eintragen — Werte aus der
lokalen `.env` übernehmen, mit **zwei Abweichungen** (markiert):

```
COPERNICUS_CLIENT_ID=...
COPERNICUS_CLIENT_SECRET=...
OPENWEATHERMAP_API_KEY=...
HETZNER_API_TOKEN=...
POSTMARK_SERVER_API_TOKEN=...                          # Postmark Versand (Server-Token = SMTP-User+Passwort)
POSTMARK_ACCOUNT_API_TOKEN=...                         # Postmark Domain-/Signatur-Verwaltung + Verifikation
GOOGLE_CLOUD_STORAGE_BUCKET=...
GOOGLE_APPLICATION_CREDENTIALS=/root/gee-sa.json      # ABWEICHUNG: Cloud-Zielpfad (lokal: Pfad zur lokalen Datei)
GEE_SA_KEY_B64=<base64 der GEE-JSON>                   # NEU: nur in der Cloud
```

Die `GEE_SA_KEY_B64` lokal so erzeugen (einzeilig, mac+Linux):
```
base64 < "$GOOGLE_APPLICATION_CREDENTIALS" | tr -d '\n'
```
Ausgabe in die Env-Var kopieren. `cloud-setup.sh` dekodiert sie beim Setup nach
`GOOGLE_APPLICATION_CREDENTIALS` (chmod 600).

> **Wichtig:** Die Node-Dienste (`api/`, `rs/`) lesen `process.env.*` direkt — in
> der Cloud ist also **keine `.env`-Datei nötig**, nur die Env-Vars. Die GEE-JSON
> ist die einzige echte *Datei*, die materialisiert werden muss.

### 3. Setup-Script
Das Feld **Setup script** ruft `bash scripts/cloud-setup.sh` auf. Das Script:
- `npm ci` in `app/`, `api/`, `rs/`,
- materialisiert die GEE-JSON aus `GEE_SA_KEY_B64` → `GOOGLE_APPLICATION_CREDENTIALS`,
- (optional) schreibt den SSH-Deploy-Key aus `SSH_DEPLOY_KEY_B64`.

Es läuft **einmal pro Umgebung** (Ergebnis gecacht, Neulauf bei Script-/Netzwerk-Änderung
oder ~alle 7 Tage), Zeitlimit ~5 min. Sollte `npm ci` das Limit reißen, in einen
`SessionStart`-Hook in `.claude/settings.json` verschieben (läuft pro Session).

### 4. Deploy aus der Cloud (optional)
Empfehlung: **nicht** aus der Cloud deployen. Entweder weiter lokal deployen, oder
mittelfristig den Deploy in eine **GitHub-Action** auf Push verlagern — dann braucht
die Cloud weder SSH-Key noch Server-Creds. Wer doch aus der Cloud deployen will:
`SSH_DEPLOY_KEY_B64` (base64 eines **dedizierten** Deploy-Keys, nicht des persönlichen)
als Env-Var setzen — `cloud-setup.sh` schreibt ihn nach `~/.ssh/id_ed25519`.

## Sicherheitshinweis
Claude-Code-Web-Env-Vars sind **nicht verschlüsselt** und für jeden sichtbar, der die
Umgebung bearbeiten darf. Deshalb: nur **rotierbare, eng gefasste** Zugangsdaten
verwenden — dediziertes CDSE-OAuth-Client-Secret, dedizierter GEE-Service-Account,
scoped Hetzner-Token, dedizierter SSH-Deploy-Key — und bei Bedarf rotieren. Keine
persönlichen Schlüssel.

## Quellen (Stand der Mechanik)
- Web-Quickstart: https://code.claude.com/docs/en/web-quickstart.md
- Cloud-Referenz (Env-Vars, Setup-Scripts, Netzwerk, Caching):
  https://code.claude.com/docs/en/claude-code-on-the-web.md
- Hooks (SessionStart u. a.): https://code.claude.com/docs/en/hooks-guide.md

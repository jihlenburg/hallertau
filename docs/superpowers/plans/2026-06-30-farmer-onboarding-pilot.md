# Farmer-Onboarding (Pilot-Grade) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pilot-grade account foundation that lets an operator assist-onboard the first few Hallertau hop farms — passwordless (magic-link primary, passkey optional), fields set up by drawing on the map (iBALIS import optional), with a human recovery path — to validate the briefing's value before any self-serve/scale build.

**Architecture:** New stateless-style Fastify 5 service `accounts/` (same shape as `api/`/`rs/`: `buildApp` + dependency-injected collaborators + version contract) backed by **Postgres on the existing prod box** (`doldenblick-01`). Magic-link tokens are stored hashed; sessions are server-side rows behind a signed httpOnly cookie. Passkeys via `@simplewebauthn`. The browser parses any iBALIS shapefile (existing `shpjs`) to GeoJSON; the backend only ever receives/stores GeoJSON. Secrets reach the service via the existing Infisical sync. nginx on prod proxies `/api/auth/*` + `/api/onboarding/*` to it.

**Tech Stack:** Fastify 5, TypeScript 5 (strict), Vitest, `pg` (node-postgres), `node-pg-migrate` (migrations), `pg-mem` (repo unit tests), `@simplewebauthn/server` + `@simplewebauthn/browser`, `@fastify/cookie`, Node `crypto` (token hashing, cookie signing), Postmark HTTP API (transactional email), `maplibre-gl` + `@mapbox/mapbox-gl-draw`-style draw (client), `shpjs` (client import). Frontend = existing Vite app (`app/`).

## Global Constraints
- **No password path anywhere.** Magic-link primary; passkey optional; operator recovery for lockouts.
- **Backend never receives raw shapefiles or secrets in code** — browser parses shapefile→GeoJSON; secrets via Infisical→EnvironmentFile→`process.env`.
- **Follow `api/`/`rs/` patterns exactly:** `src/app.ts` exports `buildApp(deps)`, default deps read `process.env`; `/api/<svc>/health` + `/api/<svc>/version`; version contract in `src/version.ts`; tests colocated `*.test.ts`; Vitest.
- **TDD, test-first.** Every behavior gets a failing test first. Mock external I/O (Postmark, clock) via injected deps; never call real Postmark/DB in unit tests (`pg-mem` for repos).
- **Tokens stored only as SHA-256 hashes**; magic-link TTL 30 min, single-use. Cookie `httpOnly; Secure; SameSite=Lax; Path=/`. Session signing key from env.
- **Sprache Deutsch** in user-facing copy; sachlich, nicht alarmierend; Frutiger/Barlow/Grün-Gold brand (see `REFERENCE.md` §3).
- **No new server box.** Postgres + `accounts/` on `doldenblick-01`. Secrets via Infisical (`accounts`-relevant keys in the `prod` env).
- **Geometry:** GeoJSON in `jsonb`; Anbaugebiet point-in-polygon in JS (no PostGIS).
- **Forward-compatible schema** (`farm_members` join) but **no team UI, no self-serve signup, no automated legitimacy gate, no admin dashboard** in this plan (deferred to the scale cycle).

## File Structure (created/modified)
```
accounts/                              # NEW service (mirror of rs/)
  package.json, tsconfig.json, vitest.config.ts
  migrations/                          # node-pg-migrate SQL/JS migrations
    001_init.sql                       # all pilot tables
  src/
    version.ts                         # VERSION + contract (like rs/src/version.ts)
    server.ts                          # listen on PORT 8789
    app.ts                             # buildApp(deps): health/version + route registration
    db/pool.ts                         # pg Pool from DATABASE_URL
    db/repos.ts                        # typed repository fns (users, farms, sessions, tokens, passkeys, schlaege)
    auth/magicLink.ts                  # createMagicLink/verifyMagicLink (pure, deps-injected)
    auth/session.ts                    # createSession/loadSession + signed-cookie helpers
    auth/passkey.ts                    # register/auth options+verify (SimpleWebAuthn wrappers)
    domain/anbaugebiet.ts              # polygons + pointInPolygon + isInHopRegion
    mail/postmark.ts                   # sendMagicLinkEmail (injected fetch)
    routes/auth.ts                     # POST /api/auth/magic-link, /verify, /passkey/*
    routes/onboarding.ts              # POST /api/onboarding/farm, /schlaege ; GET /api/onboarding/me
    operator/recovery.ts              # resendInvite/resetPasskeys/reassignFarm (used by CLI)
    operator/cli.ts                    # `node dist/operator/cli.js <cmd>` operator rescue tool
app/src/
  api/accounts.ts                      # NEW client: request/verify link, passkey, save fields, me
  onboarding/wizard.ts                 # NEW assisted wizard (invite→verify→map→import?→passkey?→done)
  onboarding/fieldMap.ts               # NEW maplibre draw/tap + shpjs import → GeoJSON
infra/
  doldenblick-accounts.service         # systemd unit
  deploy-accounts.sh                   # build+rsync+migrate+restart+nginx
  nginx-doldenblick.conf               # MODIFY: add /api/auth + /api/onboarding locations
  infisical/doldenblick-secrets-sync.py # MODIFY: also render accounts EnvironmentFile keys
```

---

### Task 1: `accounts/` service scaffold + health/version
**Files:** Create `accounts/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/version.ts`, `src/app.ts`, `src/server.ts`, `src/app.test.ts`. Copy structure from `rs/` (read `rs/src/app.ts`, `rs/src/version.ts`, `rs/package.json` first).
**Interfaces — Produces:** `buildApp(deps?: Partial<Deps>): FastifyInstance`; `GET /api/accounts/health → {status:'ok'}`; `GET /api/accounts/version → {name,version,contract}`.

- [ ] **Step 1 — failing test** `accounts/src/app.test.ts`:
```ts
import { buildApp } from './app'
test('health', async () => {
  const app = buildApp(); const r = await app.inject({ method:'GET', url:'/api/accounts/health' })
  expect(r.statusCode).toBe(200); expect(r.json()).toEqual({ status:'ok' })
})
```
- [ ] **Step 2 — run, expect FAIL** `cd accounts && npm test` → "Cannot find module './app'".
- [ ] **Step 3 — implement** `package.json` (deps: fastify@5, @fastify/cookie, pg, @simplewebauthn/server; dev: typescript, vitest, tsx, @types/node, pg-mem), `tsconfig.json` (strict, like rs/), `src/version.ts` (`export const VERSION='0.1.0'`), `src/app.ts` (`buildApp` registers health+version+routes), `src/server.ts` (PORT 8789).
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(accounts): Service-Scaffold + health/version (Fastify 5)`.

### Task 2: DB pool + migrations + repositories
**Files:** Create `accounts/migrations/001_init.sql`, `src/db/pool.ts`, `src/db/repos.ts`, `src/db/repos.test.ts`.
**Interfaces — Produces:** tables per spec §5; `repos(db)` → `{ users, farms, farmMembers, sessions, magicTokens, passkeys, schlaege }` each with `create/findBy*` typed fns. Unit tests use `pg-mem` (`newDb().adapters.createPg()`).

- [ ] **Step 1 — failing test** `repos.test.ts`: create user → findByEmail returns it; create magic token (hash) → findValid by hash within TTL; expired token not returned.
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** `001_init.sql` (CREATE TABLE users, farms, farm_members, passkey_credentials, magic_link_tokens, sessions, schlaege — columns per spec §5; `email citext`; `geometry jsonb`; FKs; indexes on email, token_hash, session id, farm_id). `pool.ts` (`new Pool({connectionString: process.env.DATABASE_URL})`). `repos.ts` (parameterized queries only).
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(accounts): Postgres-Schema + Repositories (pg, Migrationen)`.

### Task 3: Magic-link issue (token + Postmark)
**Files:** Create `src/auth/magicLink.ts`, `src/mail/postmark.ts`, `src/auth/magicLink.test.ts`. Modify `src/routes/auth.ts` (create).
**Interfaces — Consumes:** `repos`. **Produces:** `requestMagicLink({email}, {repos, sendMail, now, randomToken}) → {ok:true}`; stores `sha256(token)`, TTL 30 min; `sendMail` injected. `sendMagicLinkEmail(to, link, {fetchImpl, token})` → Postmark `POST https://api.postmarkapp.com/email` with `X-Postmark-Server-Token`. Route `POST /api/auth/magic-link {email}`.

- [ ] **Step 1 — failing test**: `requestMagicLink` with fake `repos`+`sendMail`+fixed `now`/`randomToken` stores the **hash** (not raw) and calls `sendMail` with a link containing the raw token; never logs the token.
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** `magicLink.ts` (`crypto.randomBytes`→token; `crypto.createHash('sha256')`; persist via `repos.magicTokens.create`; build `${SITE_URL}/onboarding/verify?token=…`); `postmark.ts` (injected `fetchImpl`); route wiring with default deps (`POSTMARK_SERVER_API_TOKEN` from env).
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(accounts): Magic-Link anfordern + Postmark-Versand`.

### Task 4: Magic-link verify → user + session + cookie
**Files:** Create `src/auth/session.ts`, `src/auth/session.test.ts`; modify `src/routes/auth.ts`, register `@fastify/cookie` in `app.ts`.
**Interfaces — Consumes:** `repos`, `magicLink`. **Produces:** `verifyMagicLink({token},{repos,now}) → {userId}` (single-use: marks `used_at`, rejects expired/used); `createSession(userId,{repos,now}) → sessionId`; `signCookie(id)/verifyCookie(v)` (HMAC with `SESSION_SIGNING_KEY`); route `POST /api/auth/verify {token}` → sets `Set-Cookie: db_session=<signed>; HttpOnly; Secure; SameSite=Lax; Path=/`.

- [ ] **Step 1 — failing test**: valid unused token → creates user-if-new + session + signed cookie; reused token → 401; expired → 401; tampered cookie → `verifyCookie` returns null.
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** verify (transaction: mark used + upsert user + set `email_verified_at`), session row + `crypto.createHmac('sha256', key)` cookie signing; route sets cookie.
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(accounts): Magic-Link verifizieren → Session + signiertes Cookie`.

### Task 5: Session middleware (`requireUser`)
**Files:** Modify `src/auth/session.ts` (add `loadSession`), create `src/auth/requireUser.ts` + test.
**Interfaces — Produces:** `requireUser` preHandler → attaches `req.user` (+ active `farm`) or 401; `GET /api/onboarding/me → {user, farm, schlaege}` (added in Task 9, consumes this).

- [ ] **Step 1 — failing test**: request with valid signed cookie → `req.user` set; missing/invalid cookie → 401; expired session row → 401.
- [ ] **Step 2 — run, expect FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(accounts): Session-Mittelware requireUser`.

### Task 6: Passkey registration (optional)
**Files:** Create `src/auth/passkey.ts`, `src/auth/passkey.test.ts`; modify `routes/auth.ts`.
**Interfaces — Consumes:** `requireUser`, `repos`. **Produces:** `POST /api/auth/passkey/register-options` (uses `generateRegistrationOptions`, stores challenge in session) → JSON options; `POST /api/auth/passkey/register-verify {attResp}` (`verifyRegistrationResponse`) → persists `passkey_credentials` row. `rpID`/`origin` from env (`RP_ID`, `RP_ORIGIN`).

- [ ] **Step 1 — failing test** using `@simplewebauthn/server` test helpers / a stubbed verify returning `{verified:true, registrationInfo}` → a credential row is stored for the user; `verified:false` → 400, nothing stored.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement** (challenge stored on session; deps-inject the verify fn for testability). — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(accounts): Passkey-Registrierung (WebAuthn, optional)`.

### Task 7: Passkey authentication
**Files:** Modify `src/auth/passkey.ts` (+ tests), `routes/auth.ts`.
**Interfaces — Produces:** `POST /api/auth/passkey/auth-options {email?}` → options (allowCredentials from stored creds); `POST /api/auth/passkey/auth-verify {assertion}` (`verifyAuthenticationResponse`, updates `counter`) → creates session + cookie (reuse Task 4 `createSession`).

- [ ] **Step 1 — failing test**: stubbed `verifyAuthenticationResponse` ok → session+cookie issued, counter updated; counter regression → 400.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(accounts): Passkey-Anmeldung → Session`.

### Task 8: Anbaugebiet sanity validator
**Files:** Create `src/domain/anbaugebiet.ts`, `anbaugebiet.test.ts`, `src/domain/anbaugebiete.geojson` (coarse polygons: Hallertau, Spalt, Tettnang, Elbe-Saale).
**Interfaces — Produces:** `pointInPolygon([lng,lat], ring) → boolean` (ray-casting); `isInHopRegion(geometry) → {inRegion:boolean, region?:string}` (uses centroid of polygon/feature). Pure, no I/O.

- [ ] **Step 1 — failing test**: a point near Au i.d.Hallertau → `{inRegion:true, region:'Hallertau'}`; a point in Berlin → `{inRegion:false}`; ring-boundary cases.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement** ray-casting + centroid. — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(accounts): Anbaugebiet-Sanity-Validator (Punkt-in-Polygon)`.

### Task 9: Onboarding API — farm + Schläge (GeoJSON), `me`
**Files:** Create `src/routes/onboarding.ts`, `onboarding.test.ts`.
**Interfaces — Consumes:** `requireUser`, `repos`, `isInHopRegion`. **Produces:** `POST /api/onboarding/farm {name, betriebsnummer?}` → creates `farms` + `farm_members(owner)`; `POST /api/onboarding/schlaege {features: GeoJSON[]}` → validates each via `isInHopRegion` (soft: stores `in_region` flag, never rejects), stores `schlaege` (`source` = `draw`|`ibalis`); `GET /api/onboarding/me` → `{user, farm, schlaege}`. **Backend receives only GeoJSON** (browser already parsed any shapefile).

- [ ] **Step 1 — failing test**: authed user posts farm then 2 GeoJSON Schläge (one in Hallertau, one outside) → both stored, `in_region` true/false respectively, never 4xx for out-of-region; `me` returns them.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(accounts): Onboarding-API (Betrieb + Schläge als GeoJSON) + me`.

### Task 10: Operator recovery CLI
**Files:** Create `src/operator/recovery.ts`, `recovery.test.ts`, `src/operator/cli.ts`.
**Interfaces — Consumes:** `repos`, `requestMagicLink`. **Produces:** `resendInvite(email)`, `resetPasskeys(email)` (deletes the user's `passkey_credentials`), `reassignFarm(farmId, newEmail)` (moves `farm_members.owner`). CLI: `node dist/operator/cli.js resend|reset-passkeys|reassign …`. Run on the box by the operator after out-of-band (phone) verification.

- [ ] **Step 1 — failing test**: `resetPasskeys` removes all creds for the user; `reassignFarm` repoints owner; `resendInvite` calls `requestMagicLink`.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(accounts): Betreiber-Recovery-CLI (Link/Passkey/Übertragung)`.

### Task 11: Client API module
**Files:** Create `app/src/api/accounts.ts` + test (Vitest, fetch mocked). Read `app/src/api/fieldVigor.ts` first for the established client pattern (`X-Client-API` header, `{kind:'ok'|'error'}`).
**Interfaces — Produces:** `requestMagicLink(email)`, `verifyToken(token)`, `getMe()`, `saveFarm(...)`, `saveSchlaege(features)`, `registerPasskey()`, `authPasskey(email?)` (uses `@simplewebauthn/browser` `startRegistration`/`startAuthentication`). All `credentials:'include'`.

- [ ] **Step 1 — failing test** (mock fetch): `requestMagicLink` POSTs to `/api/auth/magic-link` with the email; `getMe` returns parsed `{user,farm,schlaege}`.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(app): Accounts-Client (Magic-Link, Passkey, Onboarding)`.

### Task 12: Field map (draw/tap + optional shapefile import)
**Files:** Create `app/src/onboarding/fieldMap.ts` + test. Reuse existing `app/src/onboarding` + `shpjs` + maplibre (see `app/src/map.ts`).
**Interfaces — Produces:** `createFieldMap(container, {onChange})` → user draws/taps polygons → emits GeoJSON `features`; `importShapefile(file) → GeoJSON FeatureCollection` (via `shpjs`, reprojects to WGS84 if needed); import failure → throws so the wizard falls back to drawing.

- [ ] **Step 1 — failing test**: `importShapefile` on a fixture zip → FeatureCollection with ≥1 polygon (use a tiny test fixture); malformed zip → throws.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(app): Feld-Karte zeichnen/tippen + optionaler Shapefile-Import`.

### Task 13: Onboarding wizard UI
**Files:** Create `app/src/onboarding/wizard.ts` + test; wire into `app/src/main.ts` route (`/onboarding`, `/onboarding/verify`).
**Interfaces — Consumes:** `accounts` client, `fieldMap`. **Produces:** 4-step flow per spec §3 (verify-from-link → draw fields (import optional) → confirm → optional passkey → redirect to Übersicht). Calm German copy; brand tokens; mobile-responsive. State machine `OnboardingStep = 'verify'|'fields'|'confirm'|'passkey'|'done'`.

- [ ] **Step 1 — failing test** (jsdom): mounting with a `?token=` calls `verifyToken`; after fields saved, advancing to passkey step renders the „Später" skip; skip → redirect to `/`.
- [ ] **Step 2 — FAIL.** — [ ] **Step 3 — implement.** — [ ] **Step 4 — PASS.** — [ ] **Step 5 — commit** `feat(app): Assistierter Onboarding-Wizard (4 Schritte, passwortlos)`.

### Task 14: Infra — Postgres, Infisical secrets, systemd, nginx, deploy
**Files:** Create `infra/doldenblick-accounts.service`, `infra/deploy-accounts.sh`; modify `infra/nginx-doldenblick.conf`, `infra/infisical/doldenblick-secrets-sync.py`. **Gated:** touches prod — run only with explicit go-ahead; verify `doldenblick.de` stays 200 + rollback.

- [ ] **Step 1** — Add secrets to **Infisical `prod`** (via vault admin token, on-box, not printed): `ACCOUNTS_DATABASE_URL`, `SESSION_SIGNING_KEY` (`openssl rand`), `RP_ID=doldenblick.de`, `RP_ORIGIN=https://doldenblick.de`, `SITE_URL=https://doldenblick.de`. (`POSTMARK_SERVER_API_TOKEN` already present.)
- [ ] **Step 2** — Extend `doldenblick-secrets-sync.py`: render `/etc/doldenblick/doldenblick-accounts.env` with the accounts keys (add a second target/KEYS set); `--check` MATCH before apply.
- [ ] **Step 3** — Provision Postgres on `doldenblick-01` (native `apt-get install postgresql` or single container; create db `doldenblick`, user, grant); run `accounts/` migrations (`node-pg-migrate up`). Add prod **swap** first (precaution).
- [ ] **Step 4** — `doldenblick-accounts.service` (systemd, `EnvironmentFile=/etc/doldenblick/doldenblick-accounts.env`, `ExecStart=node dist/server.js`, port 8789, user `doldenblick`); `deploy-accounts.sh` (build, rsync `dist/`, `npm ci --omit=dev`, migrate, restart, health-check) mirroring `deploy-rs.sh`.
- [ ] **Step 5** — nginx: add `location /api/auth/ { proxy_pass http://127.0.0.1:8789; }` + `location /api/onboarding/ { … }` (+ the app `server.mjs`/`vite.config.ts` dev proxies); `nginx -t` + reload with rollback; verify `https://doldenblick.de` 200, `/api/accounts/health` 200.
- [ ] **Step 6 — commit** `feat(infra): accounts/-Dienst deployen (Postgres, Infisical, nginx, systemd)`.

---

## Self-Review
- **Spec coverage:** §1 scope→Tasks 1-14; §3 flow→Tasks 11-13; §4 auth (magic-link/passkey/session/recovery)→Tasks 3-7,10; §5 data model→Task 2; §6 architecture (no new box, Postgres on prod, Infisical, nginx)→Task 14; §8 edges (import-fallback-to-draw, soft region, lockout-recovery)→Tasks 9,10,12,13; §9 tests→every task. **Covered.**
- **Placeholder scan:** scaffold/deploy tasks intentionally reference established files to read (`rs/`, `deploy-rs.sh`, `fieldVigor.ts`) rather than re-print them — that is "follow the existing pattern," not a placeholder. Security-critical tasks (3-7) carry concrete behavior + test assertions.
- **Type consistency:** `repos`, `requireUser`, `createSession`, `requestMagicLink`, `verifyMagicLink`, `isInHopRegion`, `importShapefile` names are used consistently across tasks.
- **Scope:** one coherent deliverable (pilot foundation); no self-serve gate / dedicated box / admin UI / team UI (deferred per spec §10).

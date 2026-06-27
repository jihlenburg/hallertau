# Backend Phase 1 — Multi-Tenant Foundation & Frontend Cutover · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-hosted, containerized Postgres+PostGIS backend with email/password auth, RLS-isolated per-farm field storage, and cut the SPA over from `localStorage`-as-truth to the API (with `localStorage` kept as offline cache).

**Architecture:** One Hetzner VM running Docker Compose: a `db` container (postgis/postgis, no published host port) and an `api` container (Node/TS Fastify, bound to `127.0.0.1:8080`). Host nginx proxies `/api/` to the api container. Tenant isolation is enforced by PostgreSQL Row-Level Security; the API connects as a non-superuser role and sets `app.user_id` per request transaction.

**Tech Stack:** Node 20+, TypeScript, Fastify 4, Drizzle ORM + drizzle-kit, postgres.js driver, argon2, zod, Vitest, Docker Compose, postgis/postgis:16-3.4.

## Global Constraints

- Backend lives in a new `api/` workspace at repo root; frontend stays in `app/`. — one line, exact.
- Node engine: `>=20`. TypeScript `strict: true`.
- DB connection role for the API is `doldenblick_app` — **NOSUPERUSER, NOBYPASSRLS** (RLS must apply).
- The `db` container publishes **no host port**; reachable only on the compose network as host `db:5432`.
- The `api` container publishes only on `127.0.0.1:8080` (host nginx proxies to it).
- Geometry is `geometry(Polygon,4326)`; areas via `ST_Area(geom::geography)`; GeoJSON I/O via `ST_AsGeoJSON` / `ST_GeomFromGeoJSON`.
- Cookies: `httpOnly`, `Secure`, `SameSite=Lax`; session id is opaque (random 32 bytes, base64url).
- Secrets via `.env` (gitignored) / Docker secrets — never in images or git. Reuse the repo's existing `.env` discipline.
- Language: code identifiers/comments may be German per repo convention; commit messages German.
- **Out of scope (later plans):** WAL/PITR + off-site backups + the 4 durability artifacts (Phase 2); cross-farm analytics views (Phase 3); password reset/SMTP; second VM split.

---

### Task 1: Backend scaffold + Compose with Postgres/PostGIS

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/.env.example`, `api/vitest.config.ts`
- Create: `infra/compose.yml`
- Create: `api/src/db/pool.ts`
- Test: `api/test/db.connect.test.ts`

**Interfaces:**
- Produces: `getSql(): Sql` — a configured postgres.js client reading `DATABASE_URL`.

- [ ] **Step 1: Write `infra/compose.yml`**

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: doldenblick
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_SUPER_PASSWORD}
    volumes:
      - dbdata:/var/lib/postgresql/data        # later: bind to dedicated Hetzner Volume
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d doldenblick"]
      interval: 5s
      timeout: 3s
      retries: 10
    # NO ports: section — not published to host
  api:
    build: ../api
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SESSION_COOKIE_SECURE: "true"
    depends_on:
      db: { condition: service_healthy }
    ports:
      - "127.0.0.1:8080:8080"
volumes:
  dbdata:
```

- [ ] **Step 2: Write `api/package.json`**

```json
{
  "name": "doldenblick-api",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cookie": "^9.3.1",
    "postgres": "^3.4.4",
    "drizzle-orm": "^0.33.0",
    "argon2": "^0.41.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.16.0",
    "vitest": "^2.0.0",
    "drizzle-kit": "^0.24.0",
    "@types/node": "^20.14.0"
  }
}
```

- [ ] **Step 3: Write `api/tsconfig.json` and `api/.env.example`**

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ES2022", "moduleResolution": "bundler",
    "strict": true, "outDir": "dist", "skipLibCheck": true, "esModuleInterop": true
  },
  "include": ["src", "test"]
}
```
`api/.env.example`:
```
DATABASE_URL=postgres://doldenblick_app:CHANGE_ME@localhost:5432/doldenblick
POSTGRES_SUPER_PASSWORD=CHANGE_ME
APP_DB_PASSWORD=CHANGE_ME
SESSION_COOKIE_SECURE=false
```

- [ ] **Step 4: Write the failing connection test `api/test/db.connect.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getSql } from '../src/db/pool.ts'

describe('db', () => {
  it('connects and reports postgis available', async () => {
    const sql = getSql()
    const rows = await sql`SELECT extname FROM pg_extension WHERE extname = 'postgis'`
    expect(rows.length).toBe(1)
    await sql.end()
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd api && npm i && npm test`
Expected: FAIL — `getSql` not found / module `../src/db/pool.ts` missing.

- [ ] **Step 6: Implement `api/src/db/pool.ts`**

```ts
import postgres from 'postgres'

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return postgres(url, { max: 10 })
}
```

- [ ] **Step 7: Bring up the DB and run the test**

Run: `docker compose -f infra/compose.yml up -d db` then create the app role (Task 3 finalizes RLS; for now connect as postgres) and `cd api && npm test`.
Expected: PASS — postgis extension present (the postgis image enables it on init).

- [ ] **Step 8: Commit**

```bash
git add api infra/compose.yml
git commit -m "feat(api): Backend-Scaffold + Compose mit Postgres/PostGIS"
```

---

### Task 2: Schema & migrations (Drizzle)

**Files:**
- Create: `api/drizzle.config.ts`, `api/src/db/schema.ts`
- Create: `api/drizzle/0000_init.sql` (generated, then hand-augmented for PostGIS)
- Test: `api/test/schema.test.ts`

**Interfaces:**
- Produces: tables `users, farms, farm_members, fields, sessions`; `fields.geom geometry(Polygon,4326)` with GIST index. Drizzle table objects exported from `schema.ts` (`users`, `farms`, `farmMembers`, `fields`, `sessions`).

- [ ] **Step 1: Write `api/src/db/schema.ts`**

```ts
import { pgTable, uuid, text, timestamp, numeric, primaryKey } from 'drizzle-orm/pg-core'
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
export const farms = pgTable('farms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  region: text('region'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
export const farmMembers = pgTable('farm_members', {
  userId: uuid('user_id').notNull().references(() => users.id),
  farmId: uuid('farm_id').notNull().references(() => farms.id),
  role: text('role').notNull().default('member'),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.farmId] }) }))
export const fields = pgTable('fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmId: uuid('farm_id').notNull().references(() => farms.id),
  name: text('name').notNull(),
  variety: text('variety'),
  areaHa: numeric('area_ha'),
  source: text('source'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  // geom added via raw SQL in the migration (PostGIS type unsupported by drizzle core)
})
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
```

- [ ] **Step 2: Write `api/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  schema: './src/db/schema.ts', out: './drizzle', dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 3: Generate the migration, then hand-add the PostGIS column + index**

Run: `cd api && npx drizzle-kit generate`
Then append to the generated `api/drizzle/0000_init.sql`:
```sql
ALTER TABLE "fields" ADD COLUMN "geom" geometry(Polygon,4326) NOT NULL;
CREATE INDEX "fields_geom_gix" ON "fields" USING GIST ("geom");
```

- [ ] **Step 4: Write the failing schema test `api/test/schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getSql } from '../src/db/pool.ts'
describe('schema', () => {
  it('has fields.geom as a 4326 polygon column with gist index', async () => {
    const sql = getSql()
    const geom = await sql`SELECT type, srid FROM geometry_columns
      WHERE f_table_name = 'fields' AND f_geometry_column = 'geom'`
    expect(geom[0]).toMatchObject({ type: 'POLYGON', srid: 4326 })
    const idx = await sql`SELECT indexname FROM pg_indexes WHERE indexname = 'fields_geom_gix'`
    expect(idx.length).toBe(1)
    await sql.end()
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd api && npm test -- schema`
Expected: FAIL — table/column not present yet.

- [ ] **Step 6: Apply the migration**

Run: `cd api && DATABASE_URL=postgres://postgres:$POSTGRES_SUPER_PASSWORD@localhost:5432/doldenblick npx drizzle-kit migrate`
(temporary: connect as `postgres` until the app role exists in Task 3.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd api && npm test -- schema`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/src/db/schema.ts api/drizzle.config.ts api/drizzle
git commit -m "feat(api): Schema + Migration (users/farms/fields PostGIS/sessions)"
```

---

### Task 3: RLS policies + non-superuser app role

**Files:**
- Create: `api/drizzle/0001_rls.sql`
- Create: `api/src/db/tenant.ts`
- Test: `api/test/rls.isolation.test.ts`

**Interfaces:**
- Produces: `withTenant<T>(userId: string, fn: (tx) => Promise<T>): Promise<T>` — runs `fn` in a transaction with `SET LOCAL app.user_id`; all queries inside see only the user's farms.
- Produces: DB role `doldenblick_app` (NOSUPERUSER, NOBYPASSRLS) used by `DATABASE_URL`.

- [ ] **Step 1: Write `api/drizzle/0001_rls.sql`**

```sql
-- App role: must NOT bypass RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='doldenblick_app') THEN
    CREATE ROLE doldenblick_app LOGIN PASSWORD :'app_pw' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO doldenblick_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO doldenblick_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO doldenblick_app;

ALTER TABLE farms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields       ENABLE ROW LEVEL SECURITY;

CREATE POLICY farm_member_can_see_farm ON farms USING (
  id IN (SELECT farm_id FROM farm_members
         WHERE user_id = current_setting('app.user_id', true)::uuid));
CREATE POLICY member_rows ON farm_members USING (
  user_id = current_setting('app.user_id', true)::uuid);
CREATE POLICY field_in_my_farm ON fields USING (
  farm_id IN (SELECT farm_id FROM farm_members
              WHERE user_id = current_setting('app.user_id', true)::uuid))
  WITH CHECK (farm_id IN (SELECT farm_id FROM farm_members
              WHERE user_id = current_setting('app.user_id', true)::uuid));
```
Apply as `postgres`, passing `-v app_pw="'$APP_DB_PASSWORD'"` via psql, or run through drizzle migrate with the password substituted.

- [ ] **Step 2: Implement `api/src/db/tenant.ts`**

```ts
import { getSql } from './pool.ts'
const sql = getSql()
export async function withTenant<T>(userId: string, fn: (tx: typeof sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${userId}, true)`  // SET LOCAL
    return fn(tx)
  })
}
export { sql }
```

- [ ] **Step 3: Write the failing isolation test `api/test/rls.isolation.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { withTenant, sql } from '../src/db/tenant.ts'

let farmA: string, farmB: string, userA: string, userB: string
beforeAll(async () => {
  // seed as superuser-free app role is fine for inserts within own farm; seed via postgres in CI helper
  ;[{ id: userA }] = await sql`INSERT INTO users(email,password_hash) VALUES('a@x.de','x') RETURNING id`
  ;[{ id: userB }] = await sql`INSERT INTO users(email,password_hash) VALUES('b@x.de','x') RETURNING id`
  ;[{ id: farmA }] = await sql`INSERT INTO farms(name) VALUES('A') RETURNING id`
  ;[{ id: farmB }] = await sql`INSERT INTO farms(name) VALUES('B') RETURNING id`
  await sql`INSERT INTO farm_members(user_id,farm_id) VALUES(${userA},${farmA}),(${userB},${farmB})`
  await sql`INSERT INTO fields(farm_id,name,geom) VALUES
    (${farmA},'A1', ST_GeomFromText('POLYGON((11 48,11.001 48,11.001 48.001,11 48.001,11 48))',4326)),
    (${farmB},'B1', ST_GeomFromText('POLYGON((12 48,12.001 48,12.001 48.001,12 48.001,12 48))',4326))`
})

it('user A sees only farm A fields', async () => {
  const rows = await withTenant(userA, (tx) => tx`SELECT name FROM fields`)
  expect(rows.map(r => r.name)).toEqual(['A1'])
})
it('user B cannot read or write farm A fields', async () => {
  const rows = await withTenant(userB, (tx) => tx`SELECT name FROM fields WHERE farm_id = ${farmA}`)
  expect(rows.length).toBe(0)
})
```
(The seed uses a privileged connection helper; document that the test runner connects seed statements as `postgres` and assertions via `withTenant` as `doldenblick_app`.)

- [ ] **Step 4: Run to verify it fails**

Run: `cd api && npm test -- rls`
Expected: FAIL — policies not yet applied / app role missing.

- [ ] **Step 5: Apply the RLS migration, point `DATABASE_URL` at the app role**

Run: apply `0001_rls.sql` as postgres; set `DATABASE_URL=postgres://doldenblick_app:$APP_DB_PASSWORD@localhost:5432/doldenblick`.

- [ ] **Step 6: Run the isolation test to verify it passes**

Run: `cd api && npm test -- rls`
Expected: PASS — A sees only A; B sees zero of A.

- [ ] **Step 7: Commit**

```bash
git add api/drizzle/0001_rls.sql api/src/db/tenant.ts api/test/rls.isolation.test.ts
git commit -m "feat(api): RLS-Mandantenisolation + doldenblick_app-Rolle (+ Isolationstest)"
```

---

### Task 4: Fastify skeleton + health + config

**Files:**
- Create: `api/src/config.ts`, `api/src/server.ts`, `api/src/app.ts`
- Test: `api/test/health.test.ts`

**Interfaces:**
- Produces: `buildApp(): FastifyInstance` (testable, no listen); `GET /api/health → { ok: true }`.

- [ ] **Step 1: Write failing `api/test/health.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.ts'
it('health returns ok', async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/health' })
  expect(res.statusCode).toBe(200)
  expect(res.json()).toEqual({ ok: true })
  await app.close()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd api && npm test -- health`
Expected: FAIL — `buildApp` missing.

- [ ] **Step 3: Implement `api/src/app.ts` and `api/src/server.ts`**

```ts
// app.ts
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
export function buildApp() {
  const app = Fastify({ logger: true })
  app.register(cookie)
  app.get('/api/health', async () => ({ ok: true }))
  return app
}
```
```ts
// server.ts
import { buildApp } from './app.ts'
const app = buildApp()
app.listen({ host: '0.0.0.0', port: 8080 })
  .catch((e) => { app.log.error(e); process.exit(1) })
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd api && npm test -- health`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/app.ts api/src/server.ts api/src/config.ts api/test/health.test.ts
git commit -m "feat(api): Fastify-Skeleton + /api/health"
```

---

### Task 5: Auth — register / login / logout + session→RLS middleware

**Files:**
- Create: `api/src/auth/passwords.ts`, `api/src/auth/sessions.ts`, `api/src/auth/routes.ts`, `api/src/auth/requireUser.ts`
- Modify: `api/src/app.ts` (register auth routes + decorator)
- Test: `api/test/auth.test.ts`

**Interfaces:**
- Consumes: `withTenant`, `sql` (Task 3); `buildApp` (Task 4).
- Produces: `POST /api/auth/register {email,password,farmName} → 201 {userId}` (creates user + farm + membership); `POST /api/auth/login {email,password} → 200` sets `sid` cookie; `POST /api/auth/logout → 204`; `requireUser` preHandler that loads the session and exposes `req.userId`.

- [ ] **Step 1: Write `api/src/auth/passwords.ts` and `sessions.ts`**

```ts
// passwords.ts
import argon2 from 'argon2'
export const hashPw = (pw: string) => argon2.hash(pw, { type: argon2.argon2id })
export const verifyPw = (hash: string, pw: string) => argon2.verify(hash, pw)
```
```ts
// sessions.ts
import { randomBytes } from 'node:crypto'
import { sql } from '../db/tenant.ts'
const TTL_DAYS = 30
export const newSessionId = () => randomBytes(32).toString('base64url')
export async function createSession(userId: string) {
  const id = newSessionId()
  const exp = new Date(Date.now() + TTL_DAYS * 864e5)
  await sql`INSERT INTO sessions(id,user_id,expires_at) VALUES(${id},${userId},${exp})`
  return id
}
export async function userIdForSession(id: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM sessions WHERE id=${id} AND expires_at > now()`
  return rows[0]?.user_id ?? null
}
export const destroySession = (id: string) => sql`DELETE FROM sessions WHERE id=${id}`
```

- [ ] **Step 2: Write failing `api/test/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.ts'
it('register then login sets a session cookie; bad password rejected', async () => {
  const app = buildApp()
  const reg = await app.inject({ method:'POST', url:'/api/auth/register',
    payload:{ email:`u${Date.now()}@x.de`, password:'correct horse', farmName:'Huber' } })
  expect(reg.statusCode).toBe(201)
  const email = reg.json().email
  const ok = await app.inject({ method:'POST', url:'/api/auth/login',
    payload:{ email, password:'correct horse' } })
  expect(ok.statusCode).toBe(200)
  expect(ok.headers['set-cookie']).toMatch(/sid=/)
  const bad = await app.inject({ method:'POST', url:'/api/auth/login',
    payload:{ email, password:'wrong' } })
  expect(bad.statusCode).toBe(401)
  await app.close()
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd api && npm test -- auth`
Expected: FAIL — routes missing.

- [ ] **Step 4: Implement `api/src/auth/routes.ts` and `requireUser.ts`, wire into `app.ts`**

```ts
// routes.ts
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { sql } from '../db/tenant.ts'
import { hashPw, verifyPw } from './passwords.ts'
import { createSession, destroySession } from './sessions.ts'
const regBody = z.object({ email: z.string().email(), password: z.string().min(8), farmName: z.string().min(1) })
const loginBody = z.object({ email: z.string().email(), password: z.string() })
export function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const { email, password, farmName } = regBody.parse(req.body)
    const hash = await hashPw(password)
    const userId = await sql.begin(async (tx) => {
      const [{ id: uid }] = await tx`INSERT INTO users(email,password_hash) VALUES(${email},${hash}) RETURNING id`
      const [{ id: fid }] = await tx`INSERT INTO farms(name) VALUES(${farmName}) RETURNING id`
      await tx`INSERT INTO farm_members(user_id,farm_id,role) VALUES(${uid},${fid},'owner')`
      return uid
    })
    return reply.code(201).send({ userId, email })
  })
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = loginBody.parse(req.body)
    const rows = await sql`SELECT id,password_hash FROM users WHERE email=${email}`
    if (!rows[0] || !(await verifyPw(rows[0].password_hash, password)))
      return reply.code(401).send({ error: 'invalid_credentials' })
    const sid = await createSession(rows[0].id)
    reply.setCookie('sid', sid, { httpOnly: true, secure: process.env.SESSION_COOKIE_SECURE === 'true',
      sameSite: 'lax', path: '/', maxAge: 30 * 864e2 })
    return reply.code(200).send({ ok: true })
  })
  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies['sid']; if (sid) await destroySession(sid)
    reply.clearCookie('sid', { path: '/' }); return reply.code(204).send()
  })
}
```
```ts
// requireUser.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { userIdForSession } from './sessions.ts'
declare module 'fastify' { interface FastifyRequest { userId?: string } }
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const sid = req.cookies['sid']
  const uid = sid ? await userIdForSession(sid) : null
  if (!uid) return reply.code(401).send({ error: 'unauthorized' })
  req.userId = uid
}
```
Wire in `app.ts`: import and call `authRoutes(app)` after cookie registration.

- [ ] **Step 5: Run to verify it passes**

Run: `cd api && npm test -- auth`
Expected: PASS — 201 register, 200 login with `sid=` cookie, 401 on wrong password.

- [ ] **Step 6: Commit**

```bash
git add api/src/auth api/src/app.ts api/test/auth.test.ts
git commit -m "feat(api): Auth (Registrierung/Login/Logout) + Session→RLS-Kontext"
```

---

### Task 6: Fields CRUD (RLS-scoped, GeoJSON, area via PostGIS)

**Files:**
- Create: `api/src/fields/routes.ts`
- Modify: `api/src/app.ts` (register fields routes)
- Test: `api/test/fields.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `withTenant`.
- Produces: `GET /api/fields → FeatureCollection`; `PUT /api/fields → {count}` (replace-all, the SPA's `setFields` semantics); each feature `{ id?, properties:{name,variety,source}, geometry: <GeoJSON Polygon> }`. Server computes `area_ha`.

- [ ] **Step 1: Write failing `api/test/fields.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.ts'
async function loginNew(app) {
  const email = `f${Date.now()}@x.de`
  await app.inject({ method:'POST', url:'/api/auth/register', payload:{ email, password:'correct horse', farmName:'Huber' } })
  const res = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email, password:'correct horse' } })
  return res.headers['set-cookie']
}
const poly = { type:'Polygon', coordinates:[[[11.8,48.6],[11.802,48.6],[11.802,48.602],[11.8,48.602],[11.8,48.6]]] }
it('PUT then GET round-trips fields, scoped to the logged-in farm', async () => {
  const app = buildApp(); const cookie = await loginNew(app)
  const put = await app.inject({ method:'PUT', url:'/api/fields', headers:{ cookie },
    payload:{ type:'FeatureCollection', features:[{ properties:{ name:'Attenhofen West', variety:'Herkules' }, geometry: poly }] } })
  expect(put.statusCode).toBe(200); expect(put.json().count).toBe(1)
  const get = await app.inject({ method:'GET', url:'/api/fields', headers:{ cookie } })
  const fc = get.json()
  expect(fc.features[0].properties.name).toBe('Attenhofen West')
  expect(fc.features[0].properties.areaHa).toBeGreaterThan(0)
  await app.close()
})
it('GET without session is 401', async () => {
  const app = buildApp()
  const res = await app.inject({ method:'GET', url:'/api/fields' })
  expect(res.statusCode).toBe(401); await app.close()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd api && npm test -- fields`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement `api/src/fields/routes.ts`**

```ts
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { requireUser } from '../auth/requireUser.ts'
import { withTenant } from '../db/tenant.ts'
const feature = z.object({
  properties: z.object({ name: z.string().min(1), variety: z.string().nullish(), source: z.string().nullish() }),
  geometry: z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(z.array(z.number()))) }),
})
const fc = z.object({ type: z.literal('FeatureCollection'), features: z.array(feature) })
export function fieldRoutes(app: FastifyInstance) {
  app.get('/api/fields', { preHandler: requireUser }, async (req) =>
    withTenant(req.userId!, async (tx) => {
      const rows = await tx`SELECT id, name, variety, source, area_ha,
        ST_AsGeoJSON(geom)::json AS geometry FROM fields ORDER BY name`
      return { type: 'FeatureCollection', features: rows.map(r => ({
        type: 'Feature', id: r.id,
        properties: { name: r.name, variety: r.variety, source: r.source, areaHa: Number(r.area_ha) },
        geometry: r.geometry })) }
    }))
  app.put('/api/fields', { preHandler: requireUser }, async (req, reply) => {
    const body = fc.parse(req.body)
    const count = await withTenant(req.userId!, async (tx) => {
      const [{ farm_id }] = await tx`SELECT farm_id FROM farm_members WHERE user_id=${req.userId!} LIMIT 1`
      await tx`DELETE FROM fields WHERE farm_id=${farm_id}`
      for (const f of body.features) {
        const g = JSON.stringify(f.geometry)
        await tx`INSERT INTO fields(farm_id,name,variety,source,geom,area_ha)
          VALUES(${farm_id}, ${f.properties.name}, ${f.properties.variety ?? null},
                 ${f.properties.source ?? null}, ST_GeomFromGeoJSON(${g}),
                 ST_Area(ST_GeomFromGeoJSON(${g})::geography)/10000.0)`
      }
      return body.features.length
    })
    return reply.code(200).send({ count })
  })
}
```
Wire `fieldRoutes(app)` into `app.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd api && npm test -- fields`
Expected: PASS — round-trip works, `areaHa > 0`, unauthenticated GET is 401.

- [ ] **Step 5: Commit**

```bash
git add api/src/fields api/src/app.ts api/test/fields.test.ts
git commit -m "feat(api): Schläge-CRUD (RLS-scoped, GeoJSON, Fläche via PostGIS)"
```

---

### Task 7: nginx `/api/` proxy + deploy wiring

**Files:**
- Create: `infra/nginx-api.conf` (snippet)
- Modify: `infra/deploy.sh` (build api image, `compose up -d`, run migrations, include snippet, reload nginx)
- Create: `api/Dockerfile`

**Interfaces:**
- Produces: `https://doldenblick.de/api/health → {ok:true}` in production.

- [ ] **Step 1: Write `api/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Write `infra/nginx-api.conf` (included inside the 443 server block)**

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
(Ordering note: this must precede the existing `/api/brightsky/` block, or scope brightsky more specifically, so the brightsky proxy still wins for its path.)

- [ ] **Step 3: Extend `infra/deploy.sh`** (add after the static deploy)

```bash
ssh "$HOST" "cd /opt/doldenblick && docker compose -f compose.yml up -d --build && \
  docker compose exec -T api node dist/migrate.js && \
  cp infra/nginx-api.conf /etc/nginx/snippets/doldenblick-api.conf && \
  nginx -t && systemctl reload nginx"
```

- [ ] **Step 4: Verify in production**

Run: `curl -s https://doldenblick.de/api/health`
Expected: `{"ok":true}`. Also confirm `curl -s https://doldenblick.de/api/brightsky/alerts` still returns JSON (brightsky path unbroken).

- [ ] **Step 5: Commit**

```bash
git add api/Dockerfile infra/nginx-api.conf infra/deploy.sh
git commit -m "feat(infra): api-Container deployen + nginx /api/-Proxy"
```

---

### Task 8: Frontend cutover — API client + offline cache + first-login migration

**Files:**
- Create: `app/src/api/client.ts`
- Modify: `app/src/state.ts` (load from API, cache to localStorage, push on change)
- Test: `app/src/api/client.test.ts`, `app/src/state.migration.test.ts`

**Interfaces:**
- Consumes: backend `GET/PUT /api/fields`, `POST /api/auth/*`.
- Produces: `fetchFields(): Promise<FieldFeature[]>`, `saveFields(f: FieldFeature[]): Promise<void>`; `state.ts` uses these with `localStorage` (`doldenblick.fields.v1`) as offline cache; on first authenticated load, if the server has zero fields and localStorage has fields, it **uploads** the local fields (migration).

- [ ] **Step 1: Write failing `app/src/api/client.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchFields, saveFields } from './client'
it('saveFields PUTs a FeatureCollection and fetchFields returns features', async () => {
  const fc = { type:'FeatureCollection', features:[{ type:'Feature', properties:{ name:'A' }, geometry:{ type:'Polygon', coordinates:[] } }] }
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce({ ok:true, json: async () => ({ count:1 }) })   // PUT
    .mockResolvedValueOnce({ ok:true, json: async () => fc }) as any        // GET
  await saveFields(fc.features as any)
  const got = await fetchFields()
  expect(got[0].properties.name).toBe('A')
  expect((globalThis.fetch as any).mock.calls[0][0]).toBe('/api/fields')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run src/api/client.test.ts`
Expected: FAIL — `./client` missing.

- [ ] **Step 3: Implement `app/src/api/client.ts`**

```ts
import type { FieldFeature } from '../types'
export async function fetchFields(): Promise<FieldFeature[]> {
  const res = await fetch('/api/fields', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`fields GET ${res.status}`)
  const fc = await res.json()
  return fc.features ?? []
}
export async function saveFields(features: FieldFeature[]): Promise<void> {
  const res = await fetch('/api/fields', {
    method: 'PUT', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'FeatureCollection', features }),
  })
  if (!res.ok) throw new Error(`fields PUT ${res.status}`)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run src/api/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing migration test `app/src/state.migration.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncOnLogin } from './state'
beforeEach(() => localStorage.clear())
it('uploads local fields when server is empty (first-login migration)', async () => {
  localStorage.setItem('doldenblick.fields.v1', JSON.stringify({ type:'FeatureCollection',
    features:[{ type:'Feature', properties:{ name:'Local' }, geometry:{ type:'Polygon', coordinates:[] } }] }))
  const put = vi.fn().mockResolvedValue(undefined)
  const get = vi.fn().mockResolvedValue([])               // server empty
  await syncOnLogin({ fetchFields: get, saveFields: put } as any)
  expect(put).toHaveBeenCalledOnce()                       // local pushed up
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd app && npx vitest run src/state.migration.test.ts`
Expected: FAIL — `syncOnLogin` not exported.

- [ ] **Step 7: Add `syncOnLogin` to `app/src/state.ts`** (and have `persist()` also call `saveFields` best-effort)

```ts
import { fetchFields, saveFields } from './api/client'
// ...existing code...
export async function syncOnLogin(api = { fetchFields, saveFields }) {
  const server = await api.fetchFields()
  if (server.length === 0 && state.fields.length > 0) {
    await api.saveFields(state.fields)          // first-login migration: push local up
  } else {
    state.fields = server                       // server is source of truth
    persist()                                   // mirror into localStorage cache
    emit()
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd app && npx vitest run src/state.migration.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src/api app/src/state.ts app/src/api/client.test.ts app/src/state.migration.test.ts
git commit -m "feat(app): Frontend auf API umgestellt (Offline-Cache + Erstanmeldungs-Migration)"
```

---

## Self-Review

**Spec coverage:** §3/§4 topology → Tasks 1,7. §5 schema+RLS → Tasks 2,3. §6 auth → Task 5. §8 frontend cutover+migration → Task 8. §11 testing (RLS isolation, integration, API) → Tasks 3,5,6,8. §10 IaC/deploy → Tasks 1,7. **Deferred to later plans (per spec §12):** §7 durability harness + 4 artifacts (Phase 2), §9 analytics views (Phase 3) — intentionally not in this plan.

**Placeholder scan:** No TBD/TODO; every code step has real code; commands have expected output. The RLS seed-helper privilege note (Task 3 Step 3) is a documented constraint, not a placeholder.

**Type consistency:** `withTenant(userId, fn)` defined Task 3, used Tasks 5,6 identically. `requireUser`/`req.userId` defined Task 5, used Task 6. `fetchFields`/`saveFields` signatures defined Task 8 Step 3, consumed by `syncOnLogin` Step 7 and the client test. `fields` columns (`area_ha`, `geom`) consistent between schema (Task 2), RLS (Task 3), and CRUD (Task 6). API shape `properties.areaHa` consistent between Task 6 output and Task 6 test.

**Known follow-ups folded into later phases, not gaps:** rate-limiting on auth, password reset/SMTP, `migrate.js` entrypoint wiring (Task 7 references it — add a tiny `src/migrate.ts` that runs drizzle migrate; called out here so it isn't missed).

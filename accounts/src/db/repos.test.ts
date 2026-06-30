/**
 * Repository unit tests — uses pg-mem (no real Postgres required).
 *
 * Tests:
 *  1. create user → findByEmail returns it
 *  2. create magic token (hash) → findValidByHash within TTL returns it
 *  3. expired token → findValidByHash returns null
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { newDb } from 'pg-mem'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { repos } from './repos.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * pg-mem (2.x) does not support the citext extension, and validates
 * DEFAULT expressions at CREATE TABLE time (gen_random_uuid() is unknown).
 * Since repos.ts generates UUIDs explicitly in application code, we strip both:
 *  - CREATE EXTENSION citext → comment
 *  - citext column type     → text
 *  - DEFAULT gen_random_uuid() → removed (id always passed explicitly)
 * The production SQL file (001_init.sql) stays unchanged.
 */
function adaptForPgMem(sql: string): string {
  return sql
    .replace(/CREATE EXTENSION[^;]*citext[^;]*;/gi, '-- citext skipped (pg-mem)')
    .replace(/\bcitext\b/gi, 'text')
    .replace(/DEFAULT gen_random_uuid\(\)/gi, '')
}

const MIGRATION_SQL = adaptForPgMem(
  readFileSync(join(__dirname, '../../migrations/001_init.sql'), 'utf-8'),
)

describe('repos (pg-mem)', () => {
  let r: ReturnType<typeof repos>

  beforeAll(async () => {
    const db = newDb()
    // repos.ts generates UUIDs explicitly via crypto.randomUUID(), so we do not
    // rely on gen_random_uuid() as a column DEFAULT — no registration needed.
    const { Pool } = db.adapters.createPg()
    const pool = new Pool()
    await pool.query(MIGRATION_SQL)
    r = repos(pool)
  })

  describe('users', () => {
    it('create → findByEmail returns the user', async () => {
      const created = await r.users.create({ email: 'bauer@hallertau.de', name: 'Hans Huber' })
      expect(created.id).toBeTruthy()
      expect(created.email).toBe('bauer@hallertau.de')
      expect(created.name).toBe('Hans Huber')

      const found = await r.users.findByEmail('bauer@hallertau.de')
      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.email).toBe('bauer@hallertau.de')
    })

    it('findByEmail returns null for unknown email', async () => {
      const found = await r.users.findByEmail('nobody@nowhere.de')
      expect(found).toBeNull()
    })
  })

  describe('magicTokens', () => {
    it('create → findValidByHash returns token within TTL', async () => {
      const hash = 'sha256-abc123-valid'
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // +30 min

      const created = await r.magicTokens.create({
        email: 'invite@hallertau.de',
        token_hash: hash,
        purpose: 'login',
        expires_at: expiresAt,
      })
      expect(created.id).toBeTruthy()
      expect(created.token_hash).toBe(hash)

      const found = await r.magicTokens.findValidByHash(hash)
      expect(found).not.toBeNull()
      expect(found!.token_hash).toBe(hash)
      expect(found!.used_at).toBeNull()
    })

    it('expired token → findValidByHash returns null', async () => {
      const hash = 'sha256-def456-expired'
      const expiresAt = new Date(Date.now() - 1_000) // 1 second in the past

      await r.magicTokens.create({
        email: 'expired@hallertau.de',
        token_hash: hash,
        purpose: 'login',
        expires_at: expiresAt,
      })

      const found = await r.magicTokens.findValidByHash(hash)
      expect(found).toBeNull()
    })

    it('used token → findValidByHash returns null', async () => {
      const hash = 'sha256-ghi789-used'
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

      const created = await r.magicTokens.create({
        email: 'used@hallertau.de',
        token_hash: hash,
        purpose: 'login',
        expires_at: expiresAt,
      })
      await r.magicTokens.markUsed(created.id)

      const found = await r.magicTokens.findValidByHash(hash)
      expect(found).toBeNull()
    })

    it('consumeByHash: first call returns the token; second call returns null (atomic replay rejection)', async () => {
      const hash = 'sha256-jkl012-atomic'
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

      await r.magicTokens.create({
        email: 'atomic@hallertau.de',
        token_hash: hash,
        purpose: 'login',
        expires_at: expiresAt,
      })

      // First consume: succeeds, returns the row with used_at set
      const first = await r.magicTokens.consumeByHash(hash)
      expect(first).not.toBeNull()
      expect(first!.token_hash).toBe(hash)
      expect(first!.used_at).not.toBeNull()

      // Second consume (replay): token already has used_at set → WHERE clause fails → null
      const second = await r.magicTokens.consumeByHash(hash)
      expect(second).toBeNull()
    })
  })
})

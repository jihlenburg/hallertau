/**
 * Typed repository layer for all DoldenBlick accounts tables.
 *
 * All queries are parameterized ($1, $2, …) — no string interpolation.
 *
 * Usage:
 *   const r = repos(pool)
 *   const user = await r.users.create({ email: 'a@b.de' })
 *   const token = await r.magicTokens.findValidByHash(hash)
 */

import type { Pool } from 'pg'
import { randomUUID } from 'crypto'

// ── Domain types ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  email_verified_at: Date | null
  name: string | null
  last_login_at: Date | null
  created_at: Date
}

export interface Farm {
  id: string
  betriebsnummer: string | null
  name: string
  anbaugebiet: string
  created_at: Date
}

export interface FarmMember {
  farm_id: string
  user_id: string
  role: 'owner' | 'member'
  created_at: Date
}

export interface PasskeyCredential {
  id: string
  user_id: string
  credential_id: string
  public_key: Buffer
  counter: number
  transports: string[] | null
  device_name: string | null
  last_used_at: Date | null
  created_at: Date
}

export interface MagicLinkToken {
  id: string
  user_id: string | null
  email: string
  token_hash: string
  purpose: string
  expires_at: Date
  used_at: Date | null
  created_at: Date
}

export interface Session {
  id: string
  user_id: string
  expires_at: Date
  user_agent: string | null
  ip: string | null
  created_at: Date
}

export interface Schlag {
  id: string
  farm_id: string
  name: string
  flik: string | null
  geometry: unknown | null
  kultur: string | null
  sorte: string | null
  source: 'draw' | 'ibalis'
  created_at: Date
}

// ── Repository factories ──────────────────────────────────────────────────────

function makeUsersRepo(pool: Pool) {
  return {
    async create(input: { email: string; name?: string }): Promise<User> {
      const { rows } = await pool.query<User>(
        `INSERT INTO users (id, email, name)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [randomUUID(), input.email, input.name ?? null],
      )
      return rows[0]
    },

    async findByEmail(email: string): Promise<User | null> {
      const { rows } = await pool.query<User>(
        'SELECT * FROM users WHERE email = $1',
        [email],
      )
      return rows[0] ?? null
    },

    async findById(id: string): Promise<User | null> {
      const { rows } = await pool.query<User>(
        'SELECT * FROM users WHERE id = $1',
        [id],
      )
      return rows[0] ?? null
    },

    async markEmailVerified(id: string): Promise<void> {
      await pool.query(
        'UPDATE users SET email_verified_at = now() WHERE id = $1',
        [id],
      )
    },

    async updateLastLogin(id: string): Promise<void> {
      await pool.query(
        'UPDATE users SET last_login_at = now() WHERE id = $1',
        [id],
      )
    },
  }
}

function makeFarmsRepo(pool: Pool) {
  return {
    async create(input: {
      name: string
      anbaugebiet: string
      betriebsnummer?: string
    }): Promise<Farm> {
      const { rows } = await pool.query<Farm>(
        `INSERT INTO farms (id, name, anbaugebiet, betriebsnummer)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [randomUUID(), input.name, input.anbaugebiet, input.betriebsnummer ?? null],
      )
      return rows[0]
    },

    async findById(id: string): Promise<Farm | null> {
      const { rows } = await pool.query<Farm>(
        'SELECT * FROM farms WHERE id = $1',
        [id],
      )
      return rows[0] ?? null
    },
  }
}

function makeFarmMembersRepo(pool: Pool) {
  return {
    async create(input: {
      farm_id: string
      user_id: string
      role: 'owner' | 'member'
    }): Promise<FarmMember> {
      const { rows } = await pool.query<FarmMember>(
        // farm_members has a composite PK (farm_id, user_id) — no uuid id column.
        `INSERT INTO farm_members (farm_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.farm_id, input.user_id, input.role],
      )
      return rows[0]
    },

    async findByFarmId(farmId: string): Promise<FarmMember[]> {
      const { rows } = await pool.query<FarmMember>(
        'SELECT * FROM farm_members WHERE farm_id = $1',
        [farmId],
      )
      return rows
    },

    async findByUserId(userId: string): Promise<FarmMember[]> {
      const { rows } = await pool.query<FarmMember>(
        'SELECT * FROM farm_members WHERE user_id = $1',
        [userId],
      )
      return rows
    },
  }
}

function makePasskeysRepo(pool: Pool) {
  return {
    async create(input: {
      user_id: string
      credential_id: string
      public_key: Buffer
      counter: number
      transports?: string[]
      device_name?: string
    }): Promise<PasskeyCredential> {
      const { rows } = await pool.query<PasskeyCredential>(
        `INSERT INTO passkey_credentials
           (id, user_id, credential_id, public_key, counter, transports, device_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          randomUUID(),
          input.user_id,
          input.credential_id,
          input.public_key,
          input.counter,
          input.transports ?? null,
          input.device_name ?? null,
        ],
      )
      return rows[0]
    },

    async findByCredentialId(credentialId: string): Promise<PasskeyCredential | null> {
      const { rows } = await pool.query<PasskeyCredential>(
        'SELECT * FROM passkey_credentials WHERE credential_id = $1',
        [credentialId],
      )
      return rows[0] ?? null
    },

    async findByUserId(userId: string): Promise<PasskeyCredential[]> {
      const { rows } = await pool.query<PasskeyCredential>(
        'SELECT * FROM passkey_credentials WHERE user_id = $1',
        [userId],
      )
      return rows
    },

    async updateCounter(id: string, counter: number): Promise<void> {
      await pool.query(
        'UPDATE passkey_credentials SET counter = $1, last_used_at = now() WHERE id = $2',
        [counter, id],
      )
    },
  }
}

function makeMagicTokensRepo(pool: Pool) {
  return {
    async create(input: {
      email: string
      token_hash: string
      purpose: string
      expires_at: Date
      user_id?: string
    }): Promise<MagicLinkToken> {
      const { rows } = await pool.query<MagicLinkToken>(
        `INSERT INTO magic_link_tokens (id, email, token_hash, purpose, expires_at, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          randomUUID(),
          input.email,
          input.token_hash,
          input.purpose,
          input.expires_at,
          input.user_id ?? null,
        ],
      )
      return rows[0]
    },

    /** Returns the token only if it is not expired and not yet used. */
    async findValidByHash(tokenHash: string): Promise<MagicLinkToken | null> {
      const { rows } = await pool.query<MagicLinkToken>(
        `SELECT * FROM magic_link_tokens
         WHERE token_hash = $1
           AND expires_at > now()
           AND used_at IS NULL`,
        [tokenHash],
      )
      return rows[0] ?? null
    },

    /**
     * Atomically finds and consumes a valid token in a single UPDATE statement.
     * The WHERE clause checks `used_at IS NULL AND expires_at > now()`, so
     * concurrent replays with the same hash cannot both succeed — only one
     * UPDATE wins; the other matches zero rows and gets null back.
     * Returns the consumed row, or null if missing / expired / already used.
     */
    async consumeByHash(tokenHash: string): Promise<MagicLinkToken | null> {
      const { rows } = await pool.query<MagicLinkToken>(
        `UPDATE magic_link_tokens
         SET used_at = now()
         WHERE token_hash = $1
           AND used_at IS NULL
           AND expires_at > now()
         RETURNING *`,
        [tokenHash],
      )
      return rows[0] ?? null
    },

    /** Marks a token as consumed (single-use enforcement). */
    async markUsed(id: string): Promise<void> {
      await pool.query(
        'UPDATE magic_link_tokens SET used_at = now() WHERE id = $1',
        [id],
      )
    },
  }
}

function makeSessionsRepo(pool: Pool) {
  return {
    async create(input: {
      user_id: string
      expires_at: Date
      user_agent?: string
      ip?: string
    }): Promise<Session> {
      const { rows } = await pool.query<Session>(
        `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          randomUUID(),
          input.user_id,
          input.expires_at,
          input.user_agent ?? null,
          input.ip ?? null,
        ],
      )
      return rows[0]
    },

    async findById(id: string): Promise<Session | null> {
      const { rows } = await pool.query<Session>(
        `SELECT * FROM sessions WHERE id = $1 AND expires_at > now()`,
        [id],
      )
      return rows[0] ?? null
    },

    async deleteById(id: string): Promise<void> {
      await pool.query('DELETE FROM sessions WHERE id = $1', [id])
    },

    async deleteByUserId(userId: string): Promise<void> {
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    },
  }
}

function makeSchlaegeRepo(pool: Pool) {
  return {
    async create(input: {
      farm_id: string
      name: string
      source: 'draw' | 'ibalis'
      flik?: string
      geometry?: unknown
      kultur?: string
      sorte?: string
    }): Promise<Schlag> {
      const { rows } = await pool.query<Schlag>(
        `INSERT INTO schlaege (id, farm_id, name, source, flik, geometry, kultur, sorte)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          randomUUID(),
          input.farm_id,
          input.name,
          input.source,
          input.flik ?? null,
          input.geometry != null ? JSON.stringify(input.geometry) : null,
          input.kultur ?? null,
          input.sorte ?? null,
        ],
      )
      return rows[0]
    },

    async findByFarmId(farmId: string): Promise<Schlag[]> {
      const { rows } = await pool.query<Schlag>(
        'SELECT * FROM schlaege WHERE farm_id = $1 ORDER BY created_at',
        [farmId],
      )
      return rows
    },

    async findById(id: string): Promise<Schlag | null> {
      const { rows } = await pool.query<Schlag>(
        'SELECT * FROM schlaege WHERE id = $1',
        [id],
      )
      return rows[0] ?? null
    },
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all repository instances bound to `pool`.
 *
 * In production: pass the pool from `createPool()`.
 * In tests:      pass a pg-mem adapter pool.
 */
export function repos(pool: Pool) {
  return {
    users:       makeUsersRepo(pool),
    farms:       makeFarmsRepo(pool),
    farmMembers: makeFarmMembersRepo(pool),
    passkeys:    makePasskeysRepo(pool),
    magicTokens: makeMagicTokensRepo(pool),
    sessions:    makeSessionsRepo(pool),
    schlaege:    makeSchlaegeRepo(pool),
  }
}

export type Repos = ReturnType<typeof repos>

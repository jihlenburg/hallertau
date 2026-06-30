/**
 * Postgres connection pool.
 *
 * Usage:
 *   import { createPool } from './db/pool.js'
 *   const pool = createPool()   // reads DATABASE_URL from env
 *
 * In tests, pass a pg-mem adapter pool to `repos()` directly instead.
 */

import pg from 'pg'

export type { Pool } from 'pg'
export type { PoolClient } from 'pg'

export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return new pg.Pool({ connectionString: url })
}

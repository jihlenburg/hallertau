#!/usr/bin/env node
/**
 * Operator recovery CLI — run on the box after out-of-band (phone)
 * verification of a locked-out farmer.
 *
 * Usage:
 *   node dist/operator/cli.js resend <email>
 *   node dist/operator/cli.js reset-passkeys <email>
 *   node dist/operator/cli.js reassign <farmId> <newEmail>
 *
 * Requires DATABASE_URL and POSTMARK_SERVER_API_TOKEN in the environment.
 */

import { createPool } from '../db/pool.js'
import { repos as makeRepos } from '../db/repos.js'
import { sendMagicLinkEmail } from '../mail/postmark.js'
import { resendInvite, resetPasskeys, reassignFarm } from './recovery.js'

// ── CLI entry point ───────────────────────────────────────────────────────────

const [, , command, ...args] = process.argv

function usage(): void {
  process.stderr.write(
    [
      'Betreiber-Recovery-CLI',
      '',
      'Usage:',
      '  node dist/operator/cli.js resend <email>',
      '  node dist/operator/cli.js reset-passkeys <email>',
      '  node dist/operator/cli.js reassign <farmId> <newEmail>',
      '',
    ].join('\n'),
  )
}

async function main(): Promise<void> {
  const pool = createPool()
  const r    = makeRepos(pool)

  // Wrap the real Postmark adapter to match the SendMail signature.
  const sendMail = (to: string, link: string) => sendMagicLinkEmail(to, link)

  try {
    switch (command) {
      case 'resend': {
        const [email] = args
        if (!email) { usage(); process.exit(1) }
        await resendInvite(email, { repos: r, sendMail })
        console.log(`OK: resend → ${email.trim().toLowerCase()}`)
        break
      }

      case 'reset-passkeys': {
        const [email] = args
        if (!email) { usage(); process.exit(1) }
        const { count } = await resetPasskeys(email, { repos: r })
        console.log(`OK: reset-passkeys → ${email.trim().toLowerCase()} (${count} Passkey(s) gelöscht)`)
        break
      }

      case 'reassign': {
        const [farmId, newEmail] = args
        if (!farmId || !newEmail) { usage(); process.exit(1) }
        await reassignFarm(farmId, newEmail, { repos: r })
        console.log(`OK: reassign farm ${farmId} → ${newEmail.trim().toLowerCase()}`)
        break
      }

      default: {
        usage()
        process.exit(1)
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`FEHLER: ${msg}\n`)
  process.exit(1)
})

/**
 * Operator recovery functions — run on the box by an operator after
 * out-of-band (phone) verification of a locked-out farmer.
 *
 * All functions are fully dependency-injected so unit tests can use fakes;
 * no real DB or Postmark connection is needed in tests.
 */

import { requestMagicLink } from '../auth/magicLink.js'
import type { SendMail } from '../auth/magicLink.js'
import type { Repos } from '../db/repos.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResendInviteDeps {
  repos:    Pick<Repos, 'users' | 'magicTokens'>
  sendMail: SendMail
}

export interface ResetPasskeysDeps {
  repos: Pick<Repos, 'users' | 'passkeys'>
}

export interface ReassignFarmDeps {
  repos: Pick<Repos, 'users' | 'farmMembers'>
}

// ── resendInvite ──────────────────────────────────────────────────────────────

/**
 * Re-issues a magic-link for the given e-mail by delegating to
 * `requestMagicLink`. E-mail normalisation (trim + lowercase) is handled
 * inside `requestMagicLink`; no double-normalisation needed here.
 */
export async function resendInvite(
  email: string,
  deps: ResendInviteDeps,
): Promise<{ ok: true }> {
  return requestMagicLink({ email }, deps)
}

// ── resetPasskeys ─────────────────────────────────────────────────────────────

/**
 * Deletes ALL passkey credentials for the user identified by `email`.
 * After this the farmer can re-enroll with a new authenticator via the
 * normal magic-link → WebAuthn registration flow.
 *
 * Returns `{ok: true, count: N}` where N is the number of deleted rows.
 * Throws when the user cannot be found (operator should verify the address).
 */
export async function resetPasskeys(
  email: string,
  deps: ResetPasskeysDeps,
): Promise<{ ok: true; count: number }> {
  const normalized = email.trim().toLowerCase()
  const user = await deps.repos.users.findByEmail(normalized)

  if (!user) {
    throw new Error(`Benutzer nicht gefunden: ${normalized}`)
  }

  const count = await deps.repos.passkeys.deleteByUserId(user.id)
  return { ok: true, count }
}

// ── reassignFarm ──────────────────────────────────────────────────────────────

/**
 * Moves the `owner` membership of `farmId` to the user identified by
 * `newEmail`. If no user with that address exists yet, one is created
 * (the operator will then use `resendInvite` to send them a link).
 *
 * Returns `{ok: true}` on success.
 */
export async function reassignFarm(
  farmId: string,
  newEmail: string,
  deps: ReassignFarmDeps,
): Promise<{ ok: true }> {
  const normalized = newEmail.trim().toLowerCase()

  const existing = await deps.repos.users.findByEmail(normalized)
  const newOwner  = existing ?? await deps.repos.users.create({ email: normalized })

  await deps.repos.farmMembers.reassignOwner(farmId, newOwner.id)
  return { ok: true }
}

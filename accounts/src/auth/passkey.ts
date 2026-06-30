/**
 * Passkey registration routes — WebAuthn credential registration (optional step in onboarding).
 *
 * Both routes are authenticated (requireUser preHandler).
 *
 * Design notes:
 *  - The WebAuthn challenge is stored server-side in `users.current_webauthn_challenge`
 *    (migration 002).  The client never sends the challenge; the server reads it from the DB.
 *  - `generateRegistrationOptions` and `verifyRegistrationResponse` are dependency-injected
 *    so unit tests can stub them without any real WebAuthn ceremony.
 *  - `rpID` and `origin` default to RP_ID / RP_ORIGIN env vars; override in deps for tests.
 *  - `authPreHandler` defaults to the real `requireUser`; tests pass a fake guard that sets
 *    req.user directly, keeping passkey tests free of session/cookie machinery.
 *
 * Routes produced:
 *  POST /api/auth/passkey/register-options  — generate + store challenge, return options JSON
 *  POST /api/auth/passkey/register-verify   — verify attestation, persist credential, clear challenge
 */

import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  generateRegistrationOptions as defaultGenOptions,
  verifyRegistrationResponse  as defaultVerifyResp,
  type GenerateRegistrationOptionsOpts,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import type { Repos } from '../db/repos.js'
import { requireUser } from './requireUser.js'

// ── Injectable function types ─────────────────────────────────────────────────

type GenerateFn = (opts: GenerateRegistrationOptionsOpts) => ReturnType<typeof defaultGenOptions>
type VerifyFn   = (opts: Parameters<typeof defaultVerifyResp>[0]) => Promise<VerifiedRegistrationResponse>

// ── Public interface ──────────────────────────────────────────────────────────

export interface PasskeyRouteDeps {
  /** Full repository layer — passkeys + users (challenge) + sessions/users/farmMembers/farms (requireUser). */
  repos: Repos
  /**
   * Injectable override for generateRegistrationOptions.
   * Defaults to the real @simplewebauthn/server implementation.
   */
  generateRegistrationOptions?: GenerateFn
  /**
   * Injectable override for verifyRegistrationResponse.
   * Defaults to the real @simplewebauthn/server implementation.
   */
  verifyRegistrationResponse?: VerifyFn
  /**
   * Relying Party ID (domain without protocol).
   * Defaults to process.env.RP_ID.
   */
  rpID?: string
  /**
   * Relying Party Name shown in authenticator UIs.
   * Defaults to 'DoldenBlick'.
   */
  rpName?: string
  /**
   * Expected origin for WebAuthn verification (e.g. 'https://doldenblick.de').
   * Defaults to process.env.RP_ORIGIN.
   */
  origin?: string
  /**
   * HMAC signing key forwarded to requireUser.
   * Defaults to process.env.SESSION_SIGNING_KEY.
   */
  sessionKey?: string
  /**
   * Override the authentication preHandler — for unit testing only.
   * When omitted the real requireUser is used (production default).
   */
  authPreHandler?: preHandlerHookHandler
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerPasskeyRoutes(app: FastifyInstance, deps: PasskeyRouteDeps): void {
  const {
    repos,
    rpName = 'DoldenBlick',
  } = deps

  const genOptions = deps.generateRegistrationOptions ?? defaultGenOptions
  const verifyResp = deps.verifyRegistrationResponse  ?? defaultVerifyResp
  const rpID       = deps.rpID   ?? process.env.RP_ID   ?? 'doldenblick.de'
  const origin     = deps.origin ?? process.env.RP_ORIGIN ?? 'https://doldenblick.de'

  const guard: preHandlerHookHandler =
    deps.authPreHandler ?? requireUser({ repos, key: deps.sessionKey })

  // ── POST /api/auth/passkey/register-options ─────────────────────────────────

  /**
   * Generate WebAuthn registration options and persist the challenge server-side.
   * The client must call this first, then feed the returned options to the WebAuthn API.
   *
   * Existing passkey credentials are included in `excludeCredentials` so authenticators
   * can prevent duplicate registrations.
   *
   * Returns: PublicKeyCredentialCreationOptionsJSON (pass directly to startRegistration).
   */
  app.post('/api/auth/passkey/register-options', { preHandler: guard }, async (req, reply) => {
    const user = req.user

    // Exclude already-registered credentials so authenticators can warn the user
    const existingCreds = await repos.passkeys.findByUserId(user.id)

    const options = await genOptions({
      rpName,
      rpID,
      userName:        user.email,
      userID:          Buffer.from(user.id, 'utf8'),
      userDisplayName: user.name ?? user.email,
      excludeCredentials: existingCreds.map(cred => ({
        id:         cred.credential_id,
        transports: (cred.transports ?? []) as Parameters<typeof defaultGenOptions>[0]['excludeCredentials'][0]['transports'],
      })),
      authenticatorSelection: {
        residentKey:       'preferred',
        userVerification:  'preferred',
      },
    })

    // Persist the challenge server-side — never trust a client-sent challenge
    await repos.users.setChallenge(user.id, options.challenge)

    return reply.code(200).send(options)
  })

  // ── POST /api/auth/passkey/register-verify ──────────────────────────────────

  interface RegisterVerifyBody {
    attResp?: unknown
  }

  /**
   * Verify the WebAuthn attestation response from the browser.
   * On success: persist a passkey_credentials row, clear the stored challenge.
   * On failure: 400 (challenge is cleared to prevent replay; nothing is persisted).
   *
   * Body: { attResp: RegistrationResponseJSON }
   */
  app.post<{ Body: RegisterVerifyBody }>(
    '/api/auth/passkey/register-verify',
    { preHandler: guard },
    async (req, reply) => {
      const user       = req.user
      const { attResp } = req.body ?? {}

      if (!attResp || typeof attResp !== 'object') {
        return reply.code(400).send({ error: 'attResp fehlt oder ist kein Objekt' })
      }

      // Load the server-side challenge — must exist (register-options must have been called first)
      const expectedChallenge = await repos.users.getChallenge(user.id)
      if (!expectedChallenge) {
        return reply.code(400).send({ error: 'Keine ausstehende Passkey-Registrierung' })
      }

      let result: VerifiedRegistrationResponse
      try {
        result = await verifyResp({
          response:         attResp as RegistrationResponseJSON,
          expectedChallenge,
          expectedRPID:     rpID,
          expectedOrigin:   origin,
        })
      } catch (_err) {
        // Challenge consumed — clear it even on error to prevent reuse
        await repos.users.clearChallenge(user.id)
        return reply.code(400).send({ error: 'Passkey-Verifizierung fehlgeschlagen' })
      }

      if (!result.verified) {
        // Clear challenge on failure to prevent reuse (security hygiene)
        await repos.users.clearChallenge(user.id)
        return reply.code(400).send({ error: 'Passkey-Verifizierung fehlgeschlagen' })
      }

      // TypeScript narrows: verified === true guarantees registrationInfo is present
      const { credential } = result.registrationInfo

      await repos.passkeys.create({
        user_id:       user.id,
        credential_id: credential.id,
        public_key:    Buffer.from(credential.publicKey),
        counter:       credential.counter,
        transports:    credential.transports as string[] | undefined,
      })

      // Challenge fulfilled — clear it so it cannot be replayed
      await repos.users.clearChallenge(user.id)

      return reply.code(200).send({ ok: true })
    },
  )
}

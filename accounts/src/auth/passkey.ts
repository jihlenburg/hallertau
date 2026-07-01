/**
 * Passkey routes — WebAuthn credential registration (Task 6) + authentication (Task 7).
 *
 * Registration routes are authenticated (requireUser preHandler).
 * Authentication routes are public (sign-in).
 *
 * Design notes:
 *  - The WebAuthn challenge is stored server-side in `users.current_webauthn_challenge`
 *    (migration 002).  The client never sends the challenge; the server reads it from the DB.
 *  - All @simplewebauthn/server fns are dependency-injected so unit tests can stub them
 *    without any real WebAuthn ceremony.
 *  - `rpID` and `origin` default to RP_ID / RP_ORIGIN env vars; override in deps for tests.
 *  - `authPreHandler` defaults to the real `requireUser`; tests pass a fake guard that sets
 *    req.user directly, keeping registration tests free of session/cookie machinery.
 *  - `userVerification: 'preferred'` is used on options calls; `requireUserVerification: false`
 *    is passed to both verify functions — forgiving for varied farmer devices, avoids
 *    v9 default rejecting 'preferred' responses.
 *  - Challenge is cleared unconditionally in a `finally` block in both verify routes so a
 *    thrown credential/counter write cannot leave a reusable challenge.
 *
 * Routes produced:
 *  POST /api/auth/passkey/register-options  — (auth'd) generate + store challenge, return options
 *  POST /api/auth/passkey/register-verify   — (auth'd) verify attestation, persist credential
 *  POST /api/auth/passkey/auth-options      — (public) generate auth options, optionally by email
 *  POST /api/auth/passkey/auth-verify       — (public) verify assertion, create session + cookie
 */

import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'
import {
  generateRegistrationOptions   as defaultGenOptions,
  verifyRegistrationResponse    as defaultVerifyResp,
  generateAuthenticationOptions as defaultGenAuthOptions,
  verifyAuthenticationResponse  as defaultVerifyAuthResp,
  type GenerateRegistrationOptionsOpts,
  type VerifiedRegistrationResponse,
  type GenerateAuthenticationOptionsOpts,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server'
import type { Repos } from '../db/repos.js'
import { requireUser } from './requireUser.js'
import { createSession, signCookie } from './session.js'

// ── Injectable function types ─────────────────────────────────────────────────

type GenerateFn     = (opts: GenerateRegistrationOptionsOpts)    => ReturnType<typeof defaultGenOptions>
type VerifyFn       = (opts: Parameters<typeof defaultVerifyResp>[0])     => Promise<VerifiedRegistrationResponse>
type GenerateAuthFn = (opts: GenerateAuthenticationOptionsOpts)  => ReturnType<typeof defaultGenAuthOptions>
type VerifyAuthFn   = (opts: Parameters<typeof defaultVerifyAuthResp>[0]) => Promise<VerifiedAuthenticationResponse>

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
   * Injectable override for generateAuthenticationOptions.
   * Defaults to the real @simplewebauthn/server implementation.
   */
  generateAuthenticationOptions?: GenerateAuthFn
  /**
   * Injectable override for verifyAuthenticationResponse.
   * Defaults to the real @simplewebauthn/server implementation.
   */
  verifyAuthenticationResponse?: VerifyAuthFn
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
   * HMAC signing key for session cookies.
   * Defaults to process.env.SESSION_SIGNING_KEY.
   */
  sessionKey?: string
  /**
   * Returns "now" — injectable so tests can freeze time for session TTL.
   */
  now?: () => Date
  /**
   * Override the authentication preHandler for registration routes — for unit testing only.
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

  const genOptions     = deps.generateRegistrationOptions   ?? defaultGenOptions
  const verifyResp     = deps.verifyRegistrationResponse    ?? defaultVerifyResp
  const genAuthOptions = deps.generateAuthenticationOptions ?? defaultGenAuthOptions
  const verifyAuthResp = deps.verifyAuthenticationResponse  ?? defaultVerifyAuthResp
  const rpID           = deps.rpID   ?? process.env.RP_ID     ?? 'doldenblick.de'
  const origin         = deps.origin ?? process.env.RP_ORIGIN ?? 'https://doldenblick.de'

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
        transports: (cred.transports ?? []) as NonNullable<Parameters<typeof defaultGenOptions>[0]['excludeCredentials']>[0]['transports'],
      })),
      authenticatorSelection: {
        residentKey:      'preferred',
        userVerification: 'preferred',
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
   * On failure: 400 (challenge is cleared unconditionally via finally to prevent replay).
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

      // Challenge is cleared unconditionally so a thrown passkeys.create cannot leave
      // a reusable challenge behind.
      try {
        let result: VerifiedRegistrationResponse
        try {
          result = await verifyResp({
            response:         attResp as RegistrationResponseJSON,
            expectedChallenge,
            expectedRPID:     rpID,
            expectedOrigin:   origin,
            requireUserVerification: false,
          })
        } catch (_err) {
          return reply.code(400).send({ error: 'Passkey-Verifizierung fehlgeschlagen' })
        }

        if (!result.verified) {
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

        return reply.code(200).send({ ok: true })
      } finally {
        // Always clear the challenge — prevents replay regardless of success/failure/throw
        await repos.users.clearChallenge(user.id)
      }
    },
  )

  // ── POST /api/auth/passkey/auth-options ─────────────────────────────────────

  interface AuthOptionsBody {
    email?: unknown
  }

  /**
   * Generate WebAuthn authentication options (sign-in, public endpoint).
   *
   * If `email` is provided and the user is found, their stored credentials are included
   * as `allowCredentials` and the challenge is persisted server-side under their account.
   * Without email (discoverable-credential flow) options are returned without allowCredentials
   * and no challenge is stored — auth-verify will then fail unless a challenge exists.
   *
   * Returns: PublicKeyCredentialRequestOptionsJSON (pass directly to startAuthentication).
   */
  app.post<{ Body: AuthOptionsBody }>(
    '/api/auth/passkey/auth-options',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
    const { email } = req.body ?? {}

    let allowCredentials: { id: string; transports?: string[] }[] = []
    let userId: string | undefined

    if (typeof email === 'string' && email.trim() !== '') {
      const user = await repos.users.findByEmail(email.trim())
      if (user) {
        userId = user.id
        const creds = await repos.passkeys.findByUserId(user.id)
        allowCredentials = creds.map(c => ({
          id:         c.credential_id,
          transports: (c.transports ?? undefined) as string[] | undefined,
        }))
      }
    }

    const options = await genAuthOptions({
      rpID,
      allowCredentials: allowCredentials as Parameters<typeof defaultGenAuthOptions>[0]['allowCredentials'],
      userVerification: 'preferred',
    })

    // Persist the challenge only when we have a user (per-user storage)
    if (userId) {
      await repos.users.setChallenge(userId, options.challenge)
    }

    return reply.code(200).send(options)
  })

  // ── POST /api/auth/passkey/auth-verify ──────────────────────────────────────

  interface AuthVerifyBody {
    assertion?: unknown
  }

  /**
   * Verify the WebAuthn authentication response from the browser (sign-in, public endpoint).
   *
   * Flow:
   *  1. Extract credentialId from assertion.id
   *  2. Look up stored credential in DB
   *  3. Get stored challenge from the credential's user
   *  4. Verify with verifyAuthenticationResponse (requireUserVerification: false)
   *  5. Counter regression check (newCounter ≤ stored → 400)
   *  6. Update stored counter
   *  7. Create session + set signed db_session cookie (30-day TTL, HttpOnly Secure SameSite=Lax)
   *
   * The challenge is always cleared in a finally block (no reusable challenge on error).
   *
   * Body: { assertion: AuthenticationResponseJSON }
   */
  app.post<{ Body: AuthVerifyBody }>(
    '/api/auth/passkey/auth-verify',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
    const { assertion } = req.body ?? {}

    if (!assertion || typeof assertion !== 'object') {
      return reply.code(400).send({ error: 'assertion fehlt oder ist kein Objekt' })
    }

    // Extract the credential id so we can look up the stored credential + its user
    const assertionObj = assertion as Record<string, unknown>
    const credentialId = assertionObj.id ?? assertionObj.rawId
    if (typeof credentialId !== 'string' || credentialId === '') {
      return reply.code(400).send({ error: 'assertion.id fehlt' })
    }

    const storedCred = await repos.passkeys.findByCredentialId(credentialId)
    if (!storedCred) {
      return reply.code(400).send({ error: 'Passkey nicht gefunden' })
    }

    const expectedChallenge = await repos.users.getChallenge(storedCred.user_id)
    if (!expectedChallenge) {
      return reply.code(400).send({ error: 'Keine ausstehende Passkey-Anmeldung' })
    }

    // Challenge is cleared unconditionally so a thrown counter/session write cannot
    // leave a reusable challenge behind.
    try {
      let authResult: VerifiedAuthenticationResponse
      try {
        authResult = await verifyAuthResp({
          response:         assertion as AuthenticationResponseJSON,
          expectedChallenge,
          expectedRPID:     rpID,
          expectedOrigin:   origin,
          credential: {
            id:         storedCred.credential_id,
            publicKey:  new Uint8Array(storedCred.public_key),
            counter:    storedCred.counter,
            transports: (storedCred.transports ?? undefined) as Parameters<typeof defaultVerifyAuthResp>[0]['credential']['transports'],
          },
          requireUserVerification: false,
        })
      } catch (_err) {
        return reply.code(400).send({ error: 'Passkey-Anmeldung fehlgeschlagen' })
      }

      if (!authResult.verified) {
        return reply.code(400).send({ error: 'Passkey-Anmeldung fehlgeschlagen' })
      }

      const { newCounter } = authResult.authenticationInfo

      // Counter regression: reject replays (new counter must be strictly greater than stored)
      if (newCounter <= storedCred.counter) {
        return reply.code(400).send({ error: 'Passkey-Zähler ist rückläufig (mögliche Replay-Attacke)' })
      }

      // Persist updated counter + last_used_at
      await repos.passkeys.updateCounter(storedCred.id, newCounter)

      // Create a 30-day session and set the signed cookie
      const sessionId = await createSession(storedCred.user_id, { repos, now: deps.now })
      const signed    = signCookie(sessionId, deps.sessionKey)

      reply.setCookie('db_session', signed, {
        httpOnly: true,
        secure:   true,
        sameSite: 'lax',
        path:     '/',
        maxAge:   30 * 24 * 60 * 60,  // 30 days — matches server session TTL
      })

      return reply.code(200).send({ ok: true })
    } finally {
      // Always clear the challenge — prevents replay regardless of success/failure/throw
      await repos.users.clearChallenge(storedCred.user_id)
    }
  })
}

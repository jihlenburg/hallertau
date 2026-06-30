/**
 * Onboarding routes — Task 9.
 *
 * Endpoints:
 *   POST /api/onboarding/farm    — create farm + farm_members(owner) for the authed user.
 *   POST /api/onboarding/schlaege — store GeoJSON Schläge with a soft in_region flag (never rejects).
 *   GET  /api/onboarding/me      — return { user, farm, schlaege } for the active farm.
 *
 * All routes are behind requireUser — no anonymous access.
 *
 * Design: factory-function pattern; repos are injected so tests can stub without a DB.
 */

import type { FastifyInstance } from 'fastify'
import type { Repos } from '../db/repos.js'
import { requireUser } from '../auth/requireUser.js'
import { isInHopRegion } from '../domain/anbaugebiet.js'
import type { GeoGeometry, GeoFeature } from '../domain/anbaugebiet.js'

// ── Public interface ──────────────────────────────────────────────────────────

export interface OnboardingRouteDeps {
  repos: Repos
  /**
   * HMAC signing key for requireUser cookie verification.
   * Falls back to process.env.SESSION_SIGNING_KEY when omitted.
   */
  signingKey?: string
}

// ── Body types ────────────────────────────────────────────────────────────────

interface FarmBody {
  name?: unknown
  betriebsnummer?: unknown
}

interface SchlaegeBody {
  features?: unknown
  source?: unknown
}

// ── registerOnboardingRoutes ──────────────────────────────────────────────────

/**
 * Registers all /api/onboarding/* routes on the given Fastify instance.
 * Call from buildApp after registering auth routes.
 */
export function registerOnboardingRoutes(
  app: FastifyInstance,
  deps: OnboardingRouteDeps,
): void {
  const guard = requireUser({ repos: deps.repos, key: deps.signingKey })

  // ── POST /api/onboarding/farm ─────────────────────────────────────────────

  /**
   * Creates a farm row and an owner farm_members row for the authenticated user.
   *
   * Returns 409 when the user already owns a farm (req.farm !== null after requireUser).
   * Returns 400 when name is missing or blank.
   * Returns 201 + the farm row on success.
   */
  app.post<{ Body: FarmBody }>('/api/onboarding/farm', { preHandler: guard }, async (req, reply) => {
    // requireUser already set req.farm when the user has an active farm
    if (req.farm !== null) {
      return reply.code(409).send({ error: 'Betrieb bereits angelegt' })
    }

    const { name, betriebsnummer } = req.body ?? {}

    if (typeof name !== 'string' || name.trim() === '') {
      return reply.code(400).send({ error: 'name fehlt oder ist ungültig' })
    }

    const farm = await deps.repos.farms.create({
      name:           name.trim(),
      anbaugebiet:    'unbekannt', // refined later via Schläge
      betriebsnummer: typeof betriebsnummer === 'string' ? betriebsnummer : undefined,
    })

    await deps.repos.farmMembers.create({
      farm_id: farm.id,
      user_id: req.user.id,
      role:    'owner',
    })

    return reply.code(201).send(farm)
  })

  // ── POST /api/onboarding/schlaege ─────────────────────────────────────────

  /**
   * Stores an array of GeoJSON Feature objects as Schläge for the active farm.
   *
   * For each feature:
   *   • Calls isInHopRegion(feature.geometry) — pure JS, no I/O.
   *   • Stores a Schlag row with in_region (boolean) + region (string | null).
   *   • NEVER rejects an out-of-region feature — in_region:false is purely advisory.
   *
   * source defaults to 'draw'; pass 'ibalis' for iBalis / Mehrfachantrag imports.
   *
   * Returns 201 + the stored Schlag rows.
   * Returns 400 when the user has no farm or features is missing/empty.
   */
  app.post<{ Body: SchlaegeBody }>('/api/onboarding/schlaege', { preHandler: guard }, async (req, reply) => {
    if (!req.farm) {
      return reply.code(400).send({ error: 'Kein Betrieb vorhanden — bitte zuerst POST /api/onboarding/farm aufrufen' })
    }

    const { features, source } = req.body ?? {}

    if (!Array.isArray(features) || features.length === 0) {
      return reply.code(400).send({ error: 'features fehlt oder ist leer' })
    }

    // Validate source — only 'draw' or 'ibalis' allowed; default to 'draw'
    const validSource: 'draw' | 'ibalis' = source === 'ibalis' ? 'ibalis' : 'draw'

    const stored = await Promise.all(
      features.map(async (rawFeature: unknown) => {
        const feature = rawFeature as Record<string, unknown>

        // Accept either a GeoJSON Feature (with .geometry) or a bare geometry
        const geometry: GeoGeometry | GeoFeature =
          feature.type === 'Feature' && feature.geometry != null
            ? (rawFeature as GeoFeature)
            : (feature as unknown as GeoGeometry)

        const regionResult = isInHopRegion(geometry)

        // Derive a name: from properties.name → fallback 'Schlag'
        const props = feature.properties as Record<string, unknown> | null | undefined
        const name  = typeof props?.name === 'string' ? props.name : 'Schlag'

        return deps.repos.schlaege.create({
          farm_id:   req.farm!.id,
          name,
          source:    validSource,
          geometry:  rawFeature,
          in_region: regionResult.inRegion,
          region:    regionResult.inRegion ? regionResult.region : null,
          // Optional FLIK / kultur / sorte from Feature properties
          flik:      typeof props?.flik   === 'string' ? props.flik   : undefined,
          kultur:    typeof props?.kultur === 'string' ? props.kultur : undefined,
          sorte:     typeof props?.sorte  === 'string' ? props.sorte  : undefined,
        })
      }),
    )

    return reply.code(201).send(stored)
  })

  // ── GET /api/onboarding/me ────────────────────────────────────────────────

  /**
   * Returns the current user's profile together with their active farm and Schläge.
   *
   * Response: { user, farm: Farm | null, schlaege: Schlag[] }
   * Always 200 — an unauthenticated request is caught by requireUser (→ 401).
   */
  app.get('/api/onboarding/me', { preHandler: guard }, async (req, reply) => {
    const schlaege = req.farm
      ? await deps.repos.schlaege.findByFarmId(req.farm.id)
      : []

    return reply.code(200).send({
      user:     req.user,
      farm:     req.farm,
      schlaege,
    })
  })
}

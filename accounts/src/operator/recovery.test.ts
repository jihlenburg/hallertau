/**
 * Unit tests for operator recovery functions — all deps injected (no DB, no HTTP).
 *
 * Tests:
 *  1. resetPasskeys   — calls passkeys.deleteByUserId with the resolved user id; returns count.
 *  2. resetPasskeys   — throws when user is not found.
 *  3. reassignFarm    — find-or-creates the new owner and calls farmMembers.reassignOwner.
 *  4. reassignFarm    — reuses an existing user without calling users.create.
 *  5. reassignFarm    — normalises the e-mail before user lookup.
 *  6. resendInvite    — delegates to requestMagicLink (sendMail is called once).
 *  7. resendInvite    — normalises the e-mail before passing it on.
 */

import { describe, it, expect, vi } from 'vitest'
import { resendInvite, resetPasskeys, reassignFarm } from './recovery.js'
import type { Repos } from '../db/repos.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeUser = {
  id: 'u-1',
  email: 'bauer@hallertau.de',
  email_verified_at: null,
  name: null,
  last_login_at: null,
  created_at: new Date(),
}

const fakeToken = {
  id: 'tok-1',
  user_id: fakeUser.id,
  email: fakeUser.email,
  token_hash: 'hash',
  purpose: 'signin',
  expires_at: new Date(Date.now() + 30 * 60 * 1000),
  used_at: null,
  created_at: new Date(),
}

// ── resetPasskeys ─────────────────────────────────────────────────────────────

describe('resetPasskeys', () => {
  it('calls passkeys.deleteByUserId with the resolved user id', async () => {
    const mockRepos = {
      users: {
        findByEmail: vi.fn().mockResolvedValue(fakeUser),
      },
      passkeys: {
        deleteByUserId: vi.fn().mockResolvedValue(3),
      },
    } as unknown as Pick<Repos, 'users' | 'passkeys'>

    const result = await resetPasskeys('bauer@hallertau.de', { repos: mockRepos })

    expect(mockRepos.users.findByEmail).toHaveBeenCalledWith('bauer@hallertau.de')
    expect(mockRepos.passkeys.deleteByUserId).toHaveBeenCalledWith('u-1')
    expect(result).toEqual({ ok: true, count: 3 })
  })

  it('normalises the e-mail before user lookup', async () => {
    const mockRepos = {
      users: {
        findByEmail: vi.fn().mockResolvedValue(fakeUser),
      },
      passkeys: {
        deleteByUserId: vi.fn().mockResolvedValue(1),
      },
    } as unknown as Pick<Repos, 'users' | 'passkeys'>

    await resetPasskeys('  Bauer@Hallertau.DE  ', { repos: mockRepos })

    expect(mockRepos.users.findByEmail).toHaveBeenCalledWith('bauer@hallertau.de')
  })

  it('throws when the user is not found', async () => {
    const mockRepos = {
      users: {
        findByEmail: vi.fn().mockResolvedValue(null),
      },
      passkeys: {
        deleteByUserId: vi.fn(),
      },
    } as unknown as Pick<Repos, 'users' | 'passkeys'>

    await expect(
      resetPasskeys('nobody@example.com', { repos: mockRepos }),
    ).rejects.toThrow('nobody@example.com')

    expect(mockRepos.passkeys.deleteByUserId).not.toHaveBeenCalled()
  })
})

// ── reassignFarm ──────────────────────────────────────────────────────────────

describe('reassignFarm', () => {
  it('creates a new user and calls farmMembers.reassignOwner', async () => {
    const newUser = { ...fakeUser, id: 'u-2', email: 'new@example.com' }
    const mockRepos = {
      users: {
        findByEmail: vi.fn().mockResolvedValue(null),
        create:      vi.fn().mockResolvedValue(newUser),
      },
      farmMembers: {
        reassignOwner: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Pick<Repos, 'users' | 'farmMembers'>

    const result = await reassignFarm('farm-1', 'new@example.com', { repos: mockRepos })

    expect(mockRepos.users.findByEmail).toHaveBeenCalledWith('new@example.com')
    expect(mockRepos.users.create).toHaveBeenCalledWith({ email: 'new@example.com' })
    expect(mockRepos.farmMembers.reassignOwner).toHaveBeenCalledWith('farm-1', 'u-2')
    expect(result).toEqual({ ok: true })
  })

  it('reuses an existing user without calling users.create', async () => {
    const existingUser = { ...fakeUser, id: 'u-3', email: 'existing@example.com' }
    const mockRepos = {
      users: {
        findByEmail: vi.fn().mockResolvedValue(existingUser),
        create:      vi.fn(),
      },
      farmMembers: {
        reassignOwner: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Pick<Repos, 'users' | 'farmMembers'>

    await reassignFarm('farm-1', 'existing@example.com', { repos: mockRepos })

    expect(mockRepos.users.create).not.toHaveBeenCalled()
    expect(mockRepos.farmMembers.reassignOwner).toHaveBeenCalledWith('farm-1', 'u-3')
  })

  it('normalises the e-mail before user lookup', async () => {
    const newUser = { ...fakeUser, id: 'u-4', email: 'normed@example.com' }
    const mockRepos = {
      users: {
        findByEmail: vi.fn().mockResolvedValue(null),
        create:      vi.fn().mockResolvedValue(newUser),
      },
      farmMembers: {
        reassignOwner: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Pick<Repos, 'users' | 'farmMembers'>

    await reassignFarm('farm-2', '  Normed@EXAMPLE.COM  ', { repos: mockRepos })

    expect(mockRepos.users.findByEmail).toHaveBeenCalledWith('normed@example.com')
    expect(mockRepos.users.create).toHaveBeenCalledWith({ email: 'normed@example.com' })
  })
})

// ── resendInvite ──────────────────────────────────────────────────────────────

describe('resendInvite', () => {
  function makeResendRepos(existingUser: typeof fakeUser | null = fakeUser) {
    return {
      users: {
        findByEmail: vi.fn().mockResolvedValue(existingUser),
        create:      vi.fn().mockResolvedValue(fakeUser),
      },
      magicTokens: {
        create: vi.fn().mockResolvedValue(fakeToken),
      },
    } as unknown as Pick<Repos, 'users' | 'magicTokens'>
  }

  it('calls sendMail exactly once (delegates to requestMagicLink)', async () => {
    const mockRepos  = makeResendRepos()
    const mockSendMail = vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined)

    const result = await resendInvite('bauer@hallertau.de', {
      repos:    mockRepos,
      sendMail: mockSendMail,
    })

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })

  it('normalises the e-mail before passing it to requestMagicLink', async () => {
    const mockRepos  = makeResendRepos()
    const mockSendMail = vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined)

    await resendInvite('  Bauer@Hallertau.DE  ', {
      repos:    mockRepos,
      sendMail: mockSendMail,
    })

    // requestMagicLink normalises internally — it must have looked up the
    // normalised address, not the raw one.
    expect(mockRepos.users.findByEmail).toHaveBeenCalledWith('bauer@hallertau.de')
    const [to] = (mockSendMail as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string]
    expect(to).toBe('bauer@hallertau.de')
  })
})

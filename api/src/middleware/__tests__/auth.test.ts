import { describe, it, expect, vi } from 'vitest'
import { requireRole } from '../auth'

function createContext(role: 'OWNER' | 'STAFF' | 'PLATFORM_ADMIN') {
  const vars = {
    authUser: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      role
    }
  }

  return {
    var: vars,
    env: {} as any,
    req: {} as any,
    res: {} as any
  }
}

describe('requireRole middleware', () => {
  it('allows permitted roles', async () => {
    const ctx = createContext('OWNER')
    const next = vi.fn()

    await requireRole(['OWNER'])(ctx as any, next)

    expect(next).toHaveBeenCalled()
  })

  it('rejects unauthorized roles', async () => {
    const ctx = createContext('STAFF')

    await expect(requireRole(['OWNER'])(ctx as any, vi.fn())).rejects.toThrow('Forbidden')
  })
})

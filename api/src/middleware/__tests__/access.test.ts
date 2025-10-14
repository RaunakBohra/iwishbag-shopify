import { describe, it, expect, vi } from 'vitest'
import { requireAccessToken } from '../access'

const createContext = (token?: string) => ({
  req: {
    header: vi.fn(() => token)
  }
})

describe('requireAccessToken', () => {
  it('allows request with header', async () => {
    const ctx = createContext('jwt-token')
    const next = vi.fn()

    await requireAccessToken(ctx as any, next)

    expect(ctx.req.header).toHaveBeenCalledWith('cf-access-jwt-assertion')
    expect(next).toHaveBeenCalled()
  })

  it('throws when header missing', async () => {
    const ctx = createContext()

    await expect(requireAccessToken(ctx as any, vi.fn())).rejects.toThrow('Cloudflare Access token missing')
  })
})

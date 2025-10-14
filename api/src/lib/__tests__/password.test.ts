import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

describe('password hashing utilities', () => {
  it('hashes and verifies passwords correctly', async () => {
    const password = 'Sup3r$ecret!'
    const hash = await hashPassword(password)

    expect(hash).toBeTypeOf('string')
    expect(hash).not.toEqual(password)

    const matches = await verifyPassword(password, hash)
    expect(matches).toBe(true)

    const mismatch = await verifyPassword('wrong-password', hash)
    expect(mismatch).toBe(false)
  })
})

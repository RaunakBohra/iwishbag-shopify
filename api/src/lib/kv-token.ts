import { randomUUID } from 'node:crypto'
import { HTTPException } from 'hono/http-exception'
import type { EnvBindings } from '../types'

const encoder = new TextEncoder()

function ensureKv(env: EnvBindings) {
  if (!env.TEMP) {
    throw new HTTPException(500, { message: 'TEMP KV namespace not configured' })
  }
  return env.TEMP
}

async function importSigningKey(secret: string, prefix: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`${prefix}:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function signToken(env: EnvBindings, prefix: string, tokenId: string) {
  const key = await importSigningKey(env.JWT_SECRET, prefix)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(tokenId))
  return bufferToBase64Url(signature)
}

async function verifySignature(env: EnvBindings, prefix: string, tokenId: string, signature: string) {
  const expected = await signToken(env, prefix, tokenId)
  if (expected.length !== signature.length) return false

  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }

  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('base64')
    : btoa(binary)

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createKvSignedToken<T>(
  env: EnvBindings,
  prefix: string,
  data: T,
  ttlSeconds: number
): Promise<{ token: string; tokenId: string }> {
  const kv = ensureKv(env)
  const tokenId = randomUUID()
  await kv.put(`${prefix}:${tokenId}`, JSON.stringify(data), { expirationTtl: ttlSeconds })
  const signature = await signToken(env, prefix, tokenId)
  return {
    token: `${tokenId}.${signature}`,
    tokenId
  }
}

export async function consumeKvSignedToken<T>(
  env: EnvBindings,
  prefix: string,
  token: string,
  options: { delete?: boolean } = { delete: true }
): Promise<{ data: T; tokenId: string }> {
  const [tokenId, signature] = token.split('.')
  if (!tokenId || !signature) {
    throw new HTTPException(400, { message: 'Invalid token format' })
  }

  const validSignature = await verifySignature(env, prefix, tokenId, signature)
  if (!validSignature) {
    throw new HTTPException(401, { message: 'Invalid or tampered token' })
  }

  const kv = ensureKv(env)
  const key = `${prefix}:${tokenId}`
  const stored = await kv.get(key)

  if (!stored) {
    throw new HTTPException(410, { message: 'Token expired or not found' })
  }

  if (options.delete ?? true) {
    await kv.delete(key)
  }

  return {
    data: JSON.parse(stored) as T,
    tokenId
  }
}

export async function deleteKvSignedToken(env: EnvBindings, prefix: string, tokenId: string) {
  const kv = ensureKv(env)
  await kv.delete(`${prefix}:${tokenId}`)
}

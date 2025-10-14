import type { EnvBindings } from '../types'

export interface LogPayload {
  level: 'info' | 'warn' | 'error'
  event: string
  requestId?: string
  tenantId?: string
  userId?: string
  path?: string
  status?: number
  durationMs?: number
  [key: string]: unknown
}

/**
 * Sends structured logs to Better Stack's HTTP ingestion endpoint.
 * Call this from your Worker / API handlers after each request or on error.
 */
export async function logToBetterStack(env: Pick<EnvBindings, 'BETTERSTACK_LOGS_TOKEN' | 'BETTERSTACK_LOGS_ENDPOINT'>, payload: LogPayload) {
  if (!env?.BETTERSTACK_LOGS_TOKEN) {
    console.warn('BETTERSTACK_LOGS_TOKEN missing; skipping log forward')
    return
  }

  const endpoint = env.BETTERSTACK_LOGS_ENDPOINT ?? 'https://in.logs.betterstack.com'

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.BETTERSTACK_LOGS_TOKEN}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    })
  } catch (error) {
    console.error('Failed to forward log to Better Stack', error)
  }
}

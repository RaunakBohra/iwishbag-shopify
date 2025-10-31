import type { EnvBindings } from '../types'

interface PosthogOptions {
  distinctId?: string
}

/**
 * Sends analytics events to PostHog when the API key is configured.
 * We keep this lightweight so it can run inside Cloudflare Workers.
 */
export async function capturePosthogEvent(
  env: Pick<EnvBindings, 'POSTHOG_API_KEY' | 'POSTHOG_HOST'>,
  event: string,
  properties: Record<string, unknown>,
  options: PosthogOptions = {}
) {
  if (!env?.POSTHOG_API_KEY) {
    console.warn('POSTHOG_API_KEY missing; skipping event capture')
    return
  }

  const host = env.POSTHOG_HOST ?? 'https://app.posthog.com'
  const distinctId = options.distinctId ?? (typeof properties.tenantId === 'string' ? (properties.tenantId as string) : 'storefront')

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties
      })
    })
  } catch (error) {
    console.error('Failed to capture PostHog event', error)
  }
}

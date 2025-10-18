/**
 * API Client with automatic token refresh
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

interface RefreshResponse {
  data: {
    accessToken: string
    refreshToken: string
  }
}

let isRefreshing = false
let refreshPromise: Promise<string> | null = null

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string> {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken })
      })

      if (!response.ok) {
        // Refresh token is invalid or expired
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')

        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Session expired. Please log in again.')
      }

      const data: RefreshResponse = await response.json()
      const newAccessToken = data.data.accessToken
      const newRefreshToken = data.data.refreshToken

      // Store new tokens
      localStorage.setItem('token', newAccessToken)
      localStorage.setItem('refreshToken', newRefreshToken)

      return newAccessToken
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean
  retryOnAuthError?: boolean
}

/**
 * Make an authenticated API request with automatic token refresh
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    skipAuth = false,
    retryOnAuthError = true,
    headers = {},
    ...fetchOptions
  } = options

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`

  // Get access token
  const token = !skipAuth && typeof window !== 'undefined'
    ? localStorage.getItem('token')
    : null

  // Make the request
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include'
  })

  // Handle 401 Unauthorized - token might be expired
  if (response.status === 401 && retryOnAuthError && !skipAuth) {
    try {
      // Try to refresh the token
      const newToken = await refreshAccessToken()

      // Retry the request with the new token
      const retryResponse = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          Authorization: `Bearer ${newToken}`
        },
        credentials: 'include'
      })

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text()
        throw new Error(errorText || `Request failed with status ${retryResponse.status}`)
      }

      return await retryResponse.json()
    } catch (refreshError) {
      // Refresh failed, throw the original error
      const errorText = await response.text()
      throw new Error(errorText || 'Session expired. Please log in again.')
    }
  }

  // Handle other errors
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with status ${response.status}`)
  }

  return await response.json()
}

/**
 * Helper functions for common HTTP methods
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    }),

  delete: <T = unknown>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' })
}

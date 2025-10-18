'use client'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const CF_ACCESS_HEADER = 'cf-access-jwt-assertion'
const RAW_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

function getToken() {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem('token')
  } catch (error) {
    console.warn('Unable to read auth token from localStorage', error)
    return null
  }
}

function resolveBaseUrl() {
  if (!RAW_BASE) {
    throw new Error('NEXT_PUBLIC_API_URL must be configured for admin API calls')
  }
  return RAW_BASE
}

function buildUrl(path: string) {
  if (/^https?:/i.test(path)) {
    return path
  }
  const base = resolveBaseUrl()
  if (!path.startsWith('/')) {
    return `${base}/${path}`
  }
  return `${base}${path}`
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

type JsonBody = Record<string, unknown>

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | JsonBody | null
}

function isPlainObject(value: unknown): value is JsonBody {
  if (value === null) return false
  if (typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const url = buildUrl(path)

  const { body, headers: initHeaders, credentials, ...rest } = init
  const headers = new Headers(initHeaders ?? {})
  const token = getToken()

  const isForm = isFormData(body)
  if (!isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has(CF_ACCESS_HEADER)) {
    if (token) {
      headers.set(CF_ACCESS_HEADER, token)
    } else if (process.env.NODE_ENV !== 'production') {
      headers.set(CF_ACCESS_HEADER, 'dev-bypass')
    }
  }

  let requestBody: BodyInit | null | undefined = null

  if (isForm || body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body) || body instanceof URLSearchParams) {
    requestBody = body as BodyInit
  } else if (typeof body === 'string') {
    requestBody = body
  } else if (isPlainObject(body)) {
    requestBody = JSON.stringify(body)
  } else if (body !== undefined) {
    requestBody = body as BodyInit
  }

  const finalInit: RequestInit = {
    ...rest,
    headers,
    credentials: credentials ?? 'include',
    body: requestBody ?? undefined
  }

  const response = await fetch(url, finalInit)
  const contentType = response.headers.get('content-type') ?? ''
  let payload: any = null

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null)
  } else {
    const text = await response.text()
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText || 'Request failed'
    throw new ApiError(response.status, message, payload)
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}

export function getApiBaseUrl() {
  return resolveBaseUrl()
}

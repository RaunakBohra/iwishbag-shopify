const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const OTP_DIGITS = 6

function toUint8Array(secret: string): Uint8Array {
  const normalized = secret.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bits = []

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error('Invalid base32 character')
    }
    for (let bit = 4; bit >= 0; bit -= 1) {
      bits.push((index >> bit) & 1)
    }
  }

  const bytes = []
  for (let i = 0; i < bits.length; i += 8) {
    const chunk = bits.slice(i, i + 8)
    if (chunk.length < 8) {
      break
    }
    const byte = chunk.reduce((acc, bit, index) => (acc << 1) | bit, 0)
    bytes.push(byte)
  }

  return Uint8Array.from(bytes)
}

function cryptoRandom(values: Uint8Array) {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values)
    return values
  }

  throw new Error('Secure random generator not available')
}

export function generateTotpSecret(length = 32): string {
  const bytes = cryptoRandom(new Uint8Array(length))
  let secret = ''
  for (let i = 0; i < bytes.length; i += 1) {
    secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length]
  }
  return secret
}

function toCounterBuffer(counter: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  // big-endian
  view.setUint32(4, counter, false)
  return buffer
}

async function hotp(secret: string, counter: number): Promise<string> {
  const keyData = toUint8Array(secret)
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, toCounterBuffer(counter)))
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  const otp = binary % 10 ** OTP_DIGITS
  return otp.toString().padStart(OTP_DIGITS, '0')
}

export async function generateTotp(secret: string, timestamp = Date.now()): Promise<string> {
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS)
  return hotp(secret, counter)
}

export async function verifyTotpToken(secret: string, token: string, window = 1): Promise<boolean> {
  const normalizedToken = token.replace(/\\s+/g, '')
  if (normalizedToken.length !== OTP_DIGITS) {
    return false
  }

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS)
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = await hotp(secret, counter + offset)
    if (expected === normalizedToken) {
      return true
    }
  }

  return false
}

export function buildOtpAuthUrl(email: string, secret: string, issuer: string): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&digits=${OTP_DIGITS}&period=${STEP_SECONDS}`
}

export function generateRecoveryCodes(count = 10, segments = 4, segmentLength = 4): string[] {
  const codes: string[] = []

  for (let i = 0; i < count; i += 1) {
    const bytes = cryptoRandom(new Uint8Array(segments * segmentLength))
    const chars = Array.from(bytes).map((byte) => (byte % 32).toString(32).toUpperCase())

    const segmentsArr: string[] = []
    for (let segment = 0; segment < segments; segment += 1) {
      segmentsArr.push(chars.slice(segment * segmentLength, (segment + 1) * segmentLength).join(''))
    }
    codes.push(segmentsArr.join('-'))
  }

  return codes
}

const MIN_LENGTH = 8
const UPPERCASE_REGEX = /[A-Z]/
const LOWERCASE_REGEX = /[a-z]/
const NUMBER_REGEX = /[0-9]/
const SPECIAL_REGEX = /[^A-Za-z0-9]/

export function getPasswordErrors(password: string): string[] {
  const errors: string[] = []

  if (!password || password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters long`)
  }

  if (!UPPERCASE_REGEX.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!LOWERCASE_REGEX.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!NUMBER_REGEX.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!SPECIAL_REGEX.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return errors
}

export function isPasswordValid(password: string): boolean {
  return getPasswordErrors(password).length === 0
}

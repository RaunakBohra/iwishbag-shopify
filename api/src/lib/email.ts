import type { EnvBindings } from '../types'

interface PasswordResetEmailInput {
  to: string
  resetUrl: string
  tenantName?: string
}

const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email'

export async function sendPasswordResetEmail(env: EnvBindings, input: PasswordResetEmailInput) {
  const token = env.POSTMARK_API_TOKEN
  const from = env.PASSWORD_RESET_EMAIL_FROM

  if (!token || !from) {
    console.warn('Password reset email skipped; Postmark configuration missing', {
      hasToken: Boolean(token),
      hasFrom: Boolean(from)
    })
    return
  }

  const subject = 'Reset your NepShop password'
  const plainBody = [
    `Hi${input.tenantName ? ` ${input.tenantName}` : ''},`,
    '',
    'We received a request to reset your password. Use the link below to set a new one. The link is valid for 1 hour.',
    '',
    input.resetUrl,
    '',
    'If you did not request this change, you can safely ignore this email.',
    '',
    '— NepShop Team'
  ].join('\\n')

  const htmlBody = `
  <p>Hi${input.tenantName ? ` ${input.tenantName}` : ''},</p>
  <p>We received a request to reset your password. Use the button below to set a new one. The link is valid for 1 hour.</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="${input.resetUrl}" style="background:#2563EB;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
  </p>
  <p>If you did not request this change, you can safely ignore this email.</p>
  <p>— NepShop Team</p>
  `

  try {
    const response = await fetch(POSTMARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': token
      },
      body: JSON.stringify({
        From: from,
        To: input.to,
        Subject: subject,
        TextBody: plainBody,
        HtmlBody: htmlBody,
        MessageStream: 'reset-password'
      })
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Failed to send password reset email', response.status, text)
    }
  } catch (error) {
    console.error('Password reset email error', error)
  }
}

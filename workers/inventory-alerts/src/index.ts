import type { Queue, QueueBatch, QueueMessage } from '@cloudflare/workers-types'
import { z } from 'zod'

const messageSchema = z.object({
  tenantId: z.string(),
  productId: z.string(),
  variantId: z.string().optional(),
  available: z.number(),
  threshold: z.number(),
  triggeredAt: z.string().optional(),
  productTitle: z.string().optional(),
  variantName: z.string().optional(),
  tenantName: z.string().optional()
})

type InventoryAlertMessage = z.infer<typeof messageSchema>

interface Env {
  INVENTORY_ALERTS_DLQ?: Queue
  POSTMARK_API_TOKEN?: string
  INVENTORY_ALERT_EMAIL_FROM?: string
  INVENTORY_ALERT_EMAIL_TO?: string
  INVENTORY_ALERT_WEBHOOK_URL?: string
}

async function sendEmailAlert(message: InventoryAlertMessage, env: Env) {
  const token = env.POSTMARK_API_TOKEN
  const to = env.INVENTORY_ALERT_EMAIL_TO
  const from = env.INVENTORY_ALERT_EMAIL_FROM

  if (!token || !to || !from) {
    console.log('Inventory alert email skipped; missing Postmark configuration', {
      hasToken: Boolean(token),
      hasTo: Boolean(to),
      hasFrom: Boolean(from)
    })
    return
  }

  const subject = `Low stock: ${message.productTitle ?? message.productId}`
  const body = `Inventory for ${message.productTitle ?? message.productId}${
    message.variantName ? ` (${message.variantName})` : ''
  } is ${message.available} (threshold ${message.threshold}).`

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': token
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      TextBody: body
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Postmark request failed: ${response.status} ${text}`)
  }
}

async function sendWebhookAlert(message: InventoryAlertMessage, env: Env) {
  const url = env.INVENTORY_ALERT_WEBHOOK_URL
  if (!url) {
    console.log('Inventory alert webhook skipped; missing INVENTORY_ALERT_WEBHOOK_URL')
    return
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'inventory.low_stock',
      data: message
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Webhook notification failed: ${response.status} ${text}`)
  }
}

async function handleMessage(message: QueueMessage, env: Env) {
  const parseResult = messageSchema.safeParse(message.body)
  if (!parseResult.success) {
    console.error('Inventory alert schema failed', parseResult.error)
    await message.ack()
    return
  }

  const payload = parseResult.data
  try {
    await Promise.all([sendEmailAlert(payload, env), sendWebhookAlert(payload, env)])
    await message.ack()
  } catch (error) {
    console.error('Inventory alert delivery failed', error)
    await message.retry()
  }
}

export default {
  async queue(batch: QueueBatch, env: Env) {
    await Promise.all(
      batch.messages.map(async (message) => {
        try {
          await handleMessage(message, env)
        } catch (error) {
          console.error('Inventory alert processing failed', error)
          if (env.INVENTORY_ALERTS_DLQ) {
            await env.INVENTORY_ALERTS_DLQ.send({
              reason: 'processing_failed',
              error: error instanceof Error ? error.message : String(error),
              payload: message.body
            })
            await message.ack()
          } else {
            await message.retry()
          }
        }
      })
    )
  }
}

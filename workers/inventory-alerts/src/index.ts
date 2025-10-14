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
}

async function sendEmailAlert(message: InventoryAlertMessage) {
  console.log('Email alert', message)
}

async function sendWebhookAlert(message: InventoryAlertMessage) {
  console.log('Webhook alert', message)
}

async function handleMessage(message: QueueMessage, env: Env) {
  const parseResult = messageSchema.safeParse(message.body)
  if (!parseResult.success) {
    console.error('Inventory alert schema failed', parseResult.error)
    await message.ack()
    return
  }

  const payload = parseResult.data
  await Promise.all([sendEmailAlert(payload), sendWebhookAlert(payload)])
  await message.ack()
}

export default {
  async queue(batch: QueueBatch, env: Env) {
    await Promise.all(
      batch.messages.map(async (message) => {
        try {
          await handleMessage(message, env)
        } catch (error) {
          console.error('Inventory alert processing failed', error)
          await message.retry()
        }
      })
    )
  }
}

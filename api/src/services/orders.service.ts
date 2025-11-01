import { HTTPException } from 'hono/http-exception'
import { OrderStatus, Prisma } from '@prisma/client'
import type { AuthUser, EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'

interface ListOrdersParams {
  page?: number
  pageSize?: number
  status?: OrderStatus | 'ALL'
}

interface UpdateOrderPayload {
  status?: OrderStatus
  note?: string | null
  metadata?: Prisma.JsonValue | null
}

const ORDER_INCLUDE = {
  items: true,
  payments: true,
  events: {
    orderBy: { createdAt: 'desc' }
  },
  shippingLines: true,
  taxLines: true
} as const

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

function sanitizeDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? value.toNumber() : 0
}

function sanitizeOrder(order: Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotal: sanitizeDecimal(order.subtotal),
    discountTotal: sanitizeDecimal(order.discountTotal),
    shippingTotal: sanitizeDecimal(order.shippingTotal),
    taxTotal: sanitizeDecimal(order.taxTotal),
    total: sanitizeDecimal(order.total),
    customerId: order.customerId,
    cartId: order.cartId,
    note: order.note ?? null,
    metadata: order.metadata ?? null,
    placedAt: order.placedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    billingAddress: order.billingAddress ?? null,
    shippingAddress: order.shippingAddress ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: sanitizeDecimal(item.unitPrice),
      subtotal: sanitizeDecimal(item.subtotal),
      discountTotal: sanitizeDecimal(item.discountTotal),
      taxTotal: sanitizeDecimal(item.taxTotal),
      metadata: item.metadata ?? null
    })),
    taxLines: order.taxLines.map((line) => ({
      id: line.id,
      title: line.title,
      rate: line.rate ? line.rate.toNumber() : null,
      amount: sanitizeDecimal(line.amount),
      metadata: line.metadata ?? null
    })),
    shippingLines: order.shippingLines.map((line) => ({
      id: line.id,
      carrier: line.carrier,
      service: line.service,
      amount: sanitizeDecimal(line.amount),
      taxTotal: sanitizeDecimal(line.taxTotal),
      trackingNumber: line.trackingNumber,
      trackingUrl: line.trackingUrl,
      estimatedArrival: line.estimatedArrival?.toISOString() ?? null,
      metadata: line.metadata ?? null
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      method: payment.method,
      amount: sanitizeDecimal(payment.amount),
      currency: payment.currency,
      capturedAmount: sanitizeDecimal(payment.capturedAmount),
      refundedAmount: sanitizeDecimal(payment.refundedAmount),
      createdAt: payment.createdAt.toISOString()
    })),
    events: order.events.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message ?? null,
      data: event.data ?? null,
      createdBy: event.createdBy ?? null,
      createdAt: event.createdAt.toISOString()
    }))
  }
}

export async function listOrders(env: EnvBindings, authUser: AuthUser, params: ListOrdersParams = {}) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)
  const page = Math.max(params.page ?? 1, 1)
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100)

  const where: Prisma.OrderWhereInput = {
    tenantId
  }

  if (params.status && params.status !== 'ALL') {
    where.status = params.status
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.order.count({ where })
  ])

  return {
    data: orders.map(sanitizeOrder),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}

export async function getOrder(env: EnvBindings, authUser: AuthUser, orderId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: ORDER_INCLUDE
  })

  if (!order) {
    throw new HTTPException(404, { message: 'Order not found' })
  }

  return sanitizeOrder(order)
}

async function recordOrderEvent(
  prisma: Prisma.TransactionClient,
  orderId: string,
  type: string,
  message: string | null,
  createdBy?: string | null,
  data?: Prisma.JsonValue | null
) {
  await prisma.orderEvent.create({
    data: {
      orderId,
      type,
      message,
      createdBy: createdBy ?? null,
      data: data ?? null
    }
  })
}

export async function updateOrder(
  env: EnvBindings,
  authUser: AuthUser,
  orderId: string,
  payload: UpdateOrderPayload
) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  if (
    !payload.status &&
    payload.note === undefined &&
    payload.metadata === undefined
  ) {
    throw new HTTPException(400, { message: 'No updates provided' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, tenantId } })
    if (!order) {
      throw new HTTPException(404, { message: 'Order not found' })
    }

    const updates: Prisma.OrderUpdateInput = {}
    const events: Array<{ type: string; message: string | null }> = []

    if (payload.status && payload.status !== order.status) {
      updates.status = payload.status
      events.push({ type: 'order.status_changed', message: `Status changed from ${order.status} to ${payload.status}` })
    }

    if (payload.note !== undefined) {
      updates.note = payload.note
    }

    if (payload.metadata !== undefined) {
      updates.metadata = payload.metadata
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: updates,
      include: ORDER_INCLUDE
    })

    for (const event of events) {
      await recordOrderEvent(tx, orderId, event.type, event.message, authUser.userId)
    }

    if (payload.note && payload.note.trim().length > 0) {
      await recordOrderEvent(tx, orderId, 'order.note_added', payload.note, authUser.userId)
    }

    return updated
  })

  return sanitizeOrder(result)
}

export async function createOrderEvent(
  env: EnvBindings,
  authUser: AuthUser,
  orderId: string,
  payload: { type: string; message?: string | null; data?: Prisma.JsonValue | null }
) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } })
  if (!order) {
    throw new HTTPException(404, { message: 'Order not found' })
  }

  await prisma.orderEvent.create({
    data: {
      orderId,
      type: payload.type,
      message: payload.message ?? null,
      data: payload.data ?? null,
      createdBy: authUser.userId ?? null
    }
  })

  return { success: true }
}

export async function recordOrderCreated(
  tx: Prisma.TransactionClient,
  orderId: string,
  createdBy?: string | null,
  data?: Prisma.JsonValue | null
) {
  await recordOrderEvent(tx, orderId, 'order.created', 'Order created', createdBy ?? null, data ?? null)
}

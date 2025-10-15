import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAccessToken } from '../middleware/access'
import { getPlatformHealth, listRecentTenants } from '../services/admin.service'
import { provisionTenant } from '../services/tenant-provisioning.service'
import { getPrisma } from '../lib/prisma'

const admin = new Hono<AppEnv>()

admin.use('*', requireAccessToken)

const provisionSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, 'Slug may only contain letters, numbers, and hyphens'),
  plan: z.enum(['FREE', 'PRO', 'MAX']).optional(),
  planStatus: z.string().optional(),
  owner: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    locale: z.string().optional()
  }),
  store: z
    .object({
      name: z.string().optional(),
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/i, 'Store slug may only contain letters, numbers, and hyphens')
        .optional(),
      description: z.string().optional(),
      themeSlug: z.string().optional(),
      themeId: z.string().optional(),
      logoUrl: z.string().url().optional(),
      faviconUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional()
    })
    .optional(),
  tasks: z.array(z.string()).optional()
})

admin.get('/health', async (c) => {
  const health = await getPlatformHealth(c.env)
  return c.json({ data: health })
})

admin.get('/tenants', async (c) => {
  const tenants = await listRecentTenants(c.env)
  return c.json({ data: tenants })
})

admin.post('/tenants', zValidator('json', provisionSchema), async (c) => {
  const body = c.req.valid('json')

  const result = await provisionTenant(c.env, null, {
    name: body.name,
    slug: body.slug,
    plan: body.plan,
    planStatus: body.planStatus,
    owner: {
      email: body.owner.email,
      password: body.owner.password,
      firstName: body.owner.firstName,
      lastName: body.owner.lastName,
      locale: body.owner.locale
    },
    store: body.store
  })

  const tasks = body.tasks?.length
    ? body.tasks
    : ['seed-theme', 'seed-feature-flags', 'seed-integrations', 'seed-demo-products', 'seed-notifications']
  const payload = {
    tenantId: result.tenantId,
    adminUserId: result.ownerUserId,
    tasks,
    trigger: 'api',
    traceId: crypto.randomUUID(),
    requestedAt: new Date().toISOString()
  }

  await getPrisma(c.env).tenantProvisioningRun.update({
    where: { tenantId: result.tenantId },
    data: {
      tasks,
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      completedAt: null
    }
  }).catch(() => undefined)

  let queued = false
  if (c.env.TENANT_PROVISIONING) {
    try {
      await c.env.TENANT_PROVISIONING.send(payload)
      queued = true
    } catch (error) {
      console.error('Failed to enqueue tenant provisioning job', error)
    }
  } else {
    console.warn('TENANT_PROVISIONING queue binding missing; provisioning job not enqueued')
  }

  return c.json(
    {
      data: {
        tenantId: result.tenantId,
        ownerUserId: result.ownerUserId,
        storeId: result.storeId,
        roleIds: result.roleIds,
        permissionAssignments: result.permissionAssignments,
        provisioningQueued: queued,
        tasks
      }
    },
    201
  )
})

export default admin

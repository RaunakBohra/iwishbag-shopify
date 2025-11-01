import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole, requirePermission } from '../middleware/auth'
import { getCurrentTenant, updateTenant, getTenantStats } from '../services/tenant.service'

const tenant = new Hono<AppEnv>()

const updateSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(120).optional()
})

tenant.use('*', requireAuth)

tenant.get('/current', async (c) => {
  const authUser = c.var.authUser!
  const tenantInfo = await getCurrentTenant(c.env, authUser)
  return c.json({ data: tenantInfo })
})

tenant.patch(
  '/current',
  requireRole(['OWNER', 'PLATFORM_ADMIN']),
  requirePermission('tenant.manage'),
  zValidator('json', updateSchema),
  async (c) => {
  const authUser = c.var.authUser!
  const update = c.req.valid('json')
  const tenantInfo = await updateTenant(c.env, authUser, update)
  return c.json({ data: tenantInfo })
  }
)

tenant.get('/current/stats', requirePermission('tenant.manage'), async (c) => {
  const authUser = c.var.authUser!
  const stats = await getTenantStats(c.env, authUser)
  return c.json({ data: stats })
})

export default tenant

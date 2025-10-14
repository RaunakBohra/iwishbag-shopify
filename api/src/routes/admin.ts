import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAccessToken } from '../middleware/access'
import { getPlatformHealth, listRecentTenants } from '../services/admin.service'

const admin = new Hono<AppEnv>()

admin.use('*', requireAccessToken)

admin.get('/health', async (c) => {
  const health = await getPlatformHealth(c.env)
  return c.json({ data: health })
})

admin.get('/tenants', async (c) => {
  const tenants = await listRecentTenants(c.env)
  return c.json({ data: tenants })
})

export default admin

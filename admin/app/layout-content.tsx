'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

const PUBLIC_ROUTES = ['/login', '/register']

export function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user, tenant, isAuthenticated, isLoading, logout } = useAuth()
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  // Show loading state while checking auth
  if (isLoading && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Public routes (login/register) - no header/footer
  if (isPublicRoute) {
    return <>{children}</>
  }

  // Protected routes - show header with user info
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
      <header className="mb-8 space-y-4">
        <nav className="flex items-center justify-between text-xs">
          <Link href="/" className="text-slate-200 hover:text-emerald-300">
            ← Back to dashboard
          </Link>
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                {user?.firstName} {user?.lastName}
                {tenant && <span className="text-slate-600"> • {tenant.name}</span>}
              </span>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-400 transition"
              >
                Logout
              </button>
            </div>
          )}
        </nav>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            iwishbag admin
          </p>
          <h1 className="text-3xl font-bold">Platform Control Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            You are viewing an internal tool. Cloudflare Access protects this dashboard and ensures only
            authorized operators can view information about tenants and platform status.
          </p>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
      <footer className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
        Need elevated actions? Update Cloudflare Access or contact the platform owner.
      </footer>
    </div>
  )
}

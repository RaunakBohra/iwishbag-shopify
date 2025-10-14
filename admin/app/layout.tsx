import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'iwishbag Admin',
  description: 'Internal control panel for the iwishbag platform'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
          <header className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              iwishbag admin
            </p>
            <h1 className="text-3xl font-bold">Platform Control Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              You are viewing an internal tool. Cloudflare Access protects this dashboard and ensures only
              authorized operators can view information about tenants and platform status.
            </p>
          </header>
          <main className="flex flex-1 flex-col gap-6">{children}</main>
          <footer className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
            Need elevated actions? Update Cloudflare Access or contact the platform owner.
          </footer>
        </div>
      </body>
    </html>
  )
}

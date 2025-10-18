import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { AuthProvider } from '../lib/auth-context'
import { LayoutContent } from './layout-content'

export const metadata: Metadata = {
  title: 'iwishbag Admin',
  description: 'Internal control panel for the iwishbag platform'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <AuthProvider>
          <LayoutContent>{children}</LayoutContent>
        </AuthProvider>
      </body>
    </html>
  )
}

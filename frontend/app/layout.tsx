import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'NepShop Merchant Console',
  description: 'Manage your store, orders, and analytics'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

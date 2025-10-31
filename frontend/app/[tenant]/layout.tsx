import type { ReactNode } from 'react'
import CartProvider from '../../components/cart/CartProvider'

export default function TenantLayout({ children, params }: { children: ReactNode; params: { tenant: string } }) {
  return <CartProvider tenant={params.tenant}>{children}</CartProvider>
}

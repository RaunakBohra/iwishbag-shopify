export interface CartItemResource {
  id: string
  productId: string
  variantId: string | null
  title: string | null
  sku: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  discountTotal: number
  taxTotal: number
}

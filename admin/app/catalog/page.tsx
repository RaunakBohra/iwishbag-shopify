'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { capture } from '../../lib/posthog'

type ProductStatus = 'DRAFT' | 'ACTIVE'

interface ProductVariant {
  id: string
  name: string
  sku?: string | null
  price?: number | null
  inventory: number
}

interface ProductImage {
  id: string
  url: string
  alt?: string | null
  position: number
}

interface ProductSummary {
  id: string
  title: string
  description?: string | null
  price: number
  sku?: string | null
  inventory?: number | null
  status: ProductStatus
  variants: ProductVariant[]
  images: ProductImage[]
  createdAt: string
  updatedAt: string
}

interface MessageState {
  type: 'success' | 'error'
  text: string
}

const currencyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR'
})

const statusOptions: Array<{ label: string; value: 'ALL' | ProductStatus }> = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' }
]

function classNames(...inputs: Array<string | undefined | false | null>) {
  return inputs.filter(Boolean).join(' ')
}

function normalizeProduct(product: ProductSummary): ProductSummary {
  return {
    ...product,
    price: Number(product.price ?? 0),
    inventory: product.inventory ?? 0,
    variants: (product.variants ?? []).map((variant) => ({
      ...variant,
      price: variant.price !== undefined && variant.price !== null ? Number(variant.price) : null,
      inventory: variant.inventory ?? 0
    })),
    images: (product.images ?? []).sort((a, b) => a.position - b.position)
  }
}

export default function CatalogPage() {
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [message, setMessage] = useState<MessageState | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductStatus>('ALL')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingStatus, setPendingStatus] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<ProductSummary[]>('/v1/products')
      setProducts(data.map(normalizeProduct))
    } catch (error) {
      console.error('Failed to load products', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load products.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    if (!message) return
    const timeout = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [message])

  const toggleSelection = useCallback((productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((product) => {
      const matchesStatus =
        statusFilter === 'ALL' ? true : product.status === statusFilter
      const matchesTerm =
        !term ||
        product.title.toLowerCase().includes(term) ||
        (product.sku ?? '').toLowerCase().includes(term)
      return matchesStatus && matchesTerm
    })
  }, [products, search, statusFilter])

  const handleToggleStatus = useCallback(
    async (productId: string, nextStatus: ProductStatus) => {
      setPendingStatus((prev) => new Set(prev).add(productId))
      try {
        await apiFetch(`/v1/products/${productId}`, {
          method: 'PATCH',
          body: { status: nextStatus }
        })

        setProducts((prev) =>
          prev.map((item) =>
            item.id === productId ? { ...item, status: nextStatus } : item
          )
        )
        setMessage({ type: 'success', text: `Product ${nextStatus === 'ACTIVE' ? 'published' : 'moved to draft'}.` })
        capture('product_status_updated', { productId, status: nextStatus })
      } catch (error) {
        console.error('Failed to update product status', error)
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to update product status.'
        })
      } finally {
        setPendingStatus((prev) => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
      }
    },
    []
  )

  const handleBulkStatus = useCallback(
    async (targetStatus: ProductStatus) => {
      if (!selectedIds.size) return
      setBulkBusy(true)
      try {
        await Promise.all(
          Array.from(selectedIds).map((productId) =>
            apiFetch(`/v1/products/${productId}`, {
              method: 'PATCH',
              body: { status: targetStatus }
            })
          )
        )

        setProducts((prev) =>
          prev.map((item) =>
            selectedIds.has(item.id) ? { ...item, status: targetStatus } : item
          )
        )
        capture('product_bulk_status_updated', {
          status: targetStatus,
          count: selectedIds.size
        })
        setMessage({
          type: 'success',
          text: `Updated ${selectedIds.size} product${selectedIds.size > 1 ? 's' : ''}.`
        })
        clearSelection()
      } catch (error) {
        console.error('Bulk status update failed', error)
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to update selected products.'
        })
      } finally {
        setBulkBusy(false)
      }
    },
    [selectedIds, clearSelection]
  )

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.size) return
    const confirmDelete = window.confirm(
      `Archive ${selectedIds.size} product${selectedIds.size > 1 ? 's' : ''}?`
    )
    if (!confirmDelete) return

    setBulkBusy(true)
    try {
      await Promise.all(
        Array.from(selectedIds).map((productId) =>
          apiFetch(`/v1/products/${productId}`, { method: 'DELETE' })
        )
      )

      setProducts((prev) => prev.filter((item) => !selectedIds.has(item.id)))
      capture('product_bulk_deleted', { count: selectedIds.size })
      setMessage({
        type: 'success',
        text: `Archived ${selectedIds.size} product${selectedIds.size > 1 ? 's' : ''}.`
      })
      clearSelection()
    } catch (error) {
      console.error('Bulk delete failed', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to archive selected products.'
      })
    } finally {
      setBulkBusy(false)
    }
  }, [selectedIds, clearSelection])

  const allSelected = selectedIds.size > 0 && filteredProducts.every((product) => selectedIds.has(product.id))

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (filteredProducts.length === 0) {
        return prev
      }
      const next = new Set(prev)
      const everySelected = filteredProducts.every((product) => next.has(product.id))
      if (everySelected) {
        filteredProducts.forEach((product) => next.delete(product.id))
      } else {
        filteredProducts.forEach((product) => next.add(product.id))
      }
      return next
    })
  }, [filteredProducts])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">Catalog Management</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-50">Products</h1>
          <p className="mt-2 text-sm text-slate-300">
            Manage the catalog, publish products, and keep inventory aligned. Filters and bulk actions help you ship updates fast.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchProducts}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Refresh
          </button>
          <Link
            href="/catalog/new"
            className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
          >
            New product
          </Link>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or SKU"
              className="w-full rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 md:w-72"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ProductStatus)}
              className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>

        {message ? (
          <div
            className={classNames(
              'mt-4 rounded-xl border px-4 py-3 text-sm',
              message.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-400/40 bg-amber-500/10 text-amber-100'
            )}
          >
            {message.text}
          </div>
        ) : null}

        {selectedIds.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            <p className="font-semibold">{selectedIds.size} selected</p>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus('ACTIVE')}
              className="rounded-full border border-emerald-400/60 px-3 py-1 font-medium text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:opacity-50"
            >
              Mark active
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus('DRAFT')}
              className="rounded-full border border-slate-600 px-3 py-1 font-medium text-slate-200 transition hover:border-slate-400 hover:text-slate-100 disabled:opacity-50"
            >
              Move to draft
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkDelete}
              className="rounded-full border border-amber-400/60 px-3 py-1 font-medium text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:opacity-50"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-slate-700 px-3 py-1 font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              Clear
            </button>
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-400">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                    checked={allSelected && filteredProducts.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Inventory</th>
                <th className="px-4 py-3">Variants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading catalog…
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No products match the current filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedIds.has(product.id)
                  const nextStatus = product.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE'
                  const isUpdating = pendingStatus.has(product.id)
                  return (
                    <tr key={product.id} className="transition hover:bg-slate-900/60">
                      <td className="px-4 py-4 align-top">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                          checked={isSelected}
                          onChange={() => toggleSelection(product.id)}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Link href={`/catalog/${product.id}`} className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                          {product.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-400">
                          SKU: {product.sku ? product.sku : '—'}
                        </p>
                        {product.description ? (
                          <p className="mt-2 text-xs text-slate-500">{product.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-slate-100">
                        {currencyFormatter.format(product.price)}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-200">
                        {product.inventory ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-300">
                        {product.variants.length ? `${product.variants.length} variant${product.variants.length > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={classNames(
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                            product.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
                              : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
                          )}
                        >
                          {product.status === 'ACTIVE' ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-right text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(product.id, nextStatus)}
                          disabled={isUpdating}
                          className="rounded-full border border-slate-700 px-3 py-1 font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating…' : nextStatus === 'ACTIVE' ? 'Publish' : 'Move to draft'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '../../lib/api'
import { capture } from '../../lib/posthog'

interface InventoryLevel {
  productId: string
  productTitle: string | null
  productSku: string | null
  variantId: string | null
  variantName: string | null
  variantSku: string | null
  available: number
  reserved: number
  incoming: number
  updatedAt: string
}

interface InventoryAdjustment {
  id: string
  productId: string
  variantId: string | null
  quantity: number
  reason: string
  memo?: string | null
  createdAt: string
}

interface PaginatedResponse<T> {
  data: T
  meta: {
    page: number
    pageSize: number
    total: number
    hasNextPage: boolean
  }
}

const reasonLabels: Record<string, string> = {
  MANUAL: 'Manual',
  SHIPMENT_RECEIVED: 'Shipment received',
  ORDER_FULFILLED: 'Order fulfilled',
  DAMAGE: 'Damage',
  OTHER: 'Other'
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function classNames(...inputs: Array<string | undefined | false | null>) {
  return inputs.filter(Boolean).join(' ')
}

export default function InventoryPage() {
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)
  const [loadingAdjustments, setLoadingAdjustments] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterInStock, setFilterInStock] = useState(false)
  const [reasonFilter, setReasonFilter] = useState<string>('ALL')

  const fetchLevels = useCallback(async () => {
    setLoadingLevels(true)
    try {
      const response = await apiFetch<PaginatedResponse<InventoryLevel[]>>('/v1/inventory/levels')
      setLevels(response.data)
    } catch (err) {
      console.error('Failed to load inventory levels', err)
      setError(err instanceof Error ? err.message : 'Unable to load inventory levels.')
    } finally {
      setLoadingLevels(false)
    }
  }, [])

  const fetchAdjustments = useCallback(async () => {
    setLoadingAdjustments(true)
    try {
      const response = await apiFetch<PaginatedResponse<InventoryAdjustment[]>>('/v1/inventory/adjustments')
      setAdjustments(response.data)
    } catch (err) {
      console.error('Failed to load adjustments', err)
      setError(err instanceof Error ? err.message : 'Unable to load inventory adjustments.')
    } finally {
      setLoadingAdjustments(false)
    }
  }, [])

  useEffect(() => {
    fetchLevels()
    fetchAdjustments()
  }, [fetchLevels, fetchAdjustments])

  const filteredLevels = useMemo(() => {
    const term = search.trim().toLowerCase()
    return levels.filter((level) => {
      const matchesStock = filterInStock ? level.available > 0 : true
      const matchesTerm =
        !term ||
        (level.productTitle ?? '').toLowerCase().includes(term) ||
        (level.productSku ?? '').toLowerCase().includes(term) ||
        (level.variantName ?? '').toLowerCase().includes(term) ||
        (level.variantSku ?? '').toLowerCase().includes(term)
      return matchesStock && matchesTerm
    })
  }, [levels, filterInStock, search])

  const filteredAdjustments = useMemo(() => {
    if (reasonFilter === 'ALL') {
      return adjustments
    }
    return adjustments.filter((adjustment) => adjustment.reason === reasonFilter)
  }, [adjustments, reasonFilter])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">Inventory Control</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-50">Stock levels & adjustments</h1>
          <p className="mt-2 text-sm text-slate-300">
            Monitor product availability, export adjustments, and ensure low-stock alerts are addressed. Inventory updates are logged and appear within seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchLevels()
              fetchAdjustments()
              capture('inventory_page_refreshed')
            }}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Refresh
          </button>
          <Link
            href="/catalog"
            className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            Back to catalog
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Inventory levels</h2>
            <p className="text-xs text-slate-400">Snapshot of current stock across products and variants.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product or SKU"
              className="w-full rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 md:w-72"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={filterInStock}
                onChange={(event) => setFilterInStock(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
              />
              In stock only
            </label>
          </div>
        </header>

        {loadingLevels ? (
          <p className="py-6 text-sm text-slate-400">Loading inventory levels…</p>
        ) : filteredLevels.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">No inventory records match the current filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Reserved</th>
                  <th className="px-4 py-3 text-right">Incoming</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/70">
                {filteredLevels.map((level) => (
                  <tr key={`${level.productId}-${level.variantId ?? 'base'}`} className="transition hover:bg-slate-900/60">
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-slate-100">{level.productTitle ?? level.productId}</p>
                      <p className="text-xs text-slate-500">SKU: {level.productSku ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      {level.variantId ? (
                        <>
                          <p>{level.variantName ?? 'Variant'}</p>
                          <p className="text-slate-500">SKU: {level.variantSku ?? '—'}</p>
                        </>
                      ) : (
                        <span className="text-slate-500">Base product</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right text-sm font-semibold text-slate-100">
                      {level.available}
                    </td>
                    <td className="px-4 py-3 align-top text-right text-sm text-slate-300">{level.reserved}</td>
                    <td className="px-4 py-3 align-top text-right text-sm text-slate-300">{level.incoming}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-400">{formatDate(level.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Recent adjustments</h2>
            <p className="text-xs text-slate-400">Manual counts, shipments, and corrections recorded across the catalog.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-300">
              <span className="mr-2 font-medium text-slate-200">Reason</span>
              <select
                value={reasonFilter}
                onChange={(event) => setReasonFilter(event.target.value)}
                className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="ALL">All reasons</option>
                {Object.entries(reasonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href="/catalog"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
            >
              New adjustment
            </Link>
          </div>
        </header>

        {loadingAdjustments ? (
          <p className="py-6 text-sm text-slate-400">Loading adjustments…</p>
        ) : filteredAdjustments.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">No adjustments recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product / Variant</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Memo</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/70">
                {filteredAdjustments.map((adjustment) => (
                  <tr key={adjustment.id} className="transition hover:bg-slate-900/60">
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <p className="font-semibold text-slate-100">{adjustment.productId}</p>
                      {adjustment.variantId ? <p className="text-slate-500">Variant: {adjustment.variantId}</p> : null}
                    </td>
                    <td className="px-4 py-3 align-top text-right text-sm font-semibold text-slate-100">{adjustment.quantity > 0 ? `+${adjustment.quantity}` : adjustment.quantity}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">{reasonLabels[adjustment.reason] ?? adjustment.reason}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-400">{adjustment.memo ?? '—'}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-400">{formatDate(adjustment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { capture } from '../../../lib/posthog'

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

const statusOptions: Array<{ label: string; value: ProductStatus }> = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Active', value: 'ACTIVE' }
]

const currencyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR'
})

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

export default function CatalogDetailPage() {
  const params = useParams<{ productId: string }>()
  const router = useRouter()
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId
  const isNew = !productId || productId === 'new'

  const [product, setProduct] = useState<ProductSummary | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [message, setMessage] = useState<MessageState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    sku: '',
    inventory: '',
    status: 'DRAFT' as ProductStatus
  })

  const [variantForm, setVariantForm] = useState({
    name: '',
    sku: '',
    price: '',
    inventory: ''
  })

  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [editingForm, setEditingForm] = useState({
    name: '',
    sku: '',
    price: '',
    inventory: ''
  })

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  const loadProduct = useCallback(async () => {
    if (isNew) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [allProducts, variantList, imageList] = await Promise.all([
        apiFetch<ProductSummary[]>('/v1/products'),
        apiFetch<ProductVariant[]>(`/v1/product-variants/${productId}`),
        apiFetch<ProductImage[]>(`/v1/product-media/${productId}`)
      ])

      const found = allProducts.find((item) => item.id === productId)
      if (!found) {
        setError('Product not found.')
        return
      }

      const normalized = normalizeProduct(found)
      setProduct(normalized)
      setVariants(variantList.map((variant) => ({
        ...variant,
        price: variant.price !== undefined && variant.price !== null ? Number(variant.price) : null,
        inventory: variant.inventory ?? 0
      })))
      setImages(imageList.sort((a, b) => a.position - b.position))
      setForm({
        title: normalized.title,
        description: normalized.description ?? '',
        price: normalized.price ? String(normalized.price) : '',
        sku: normalized.sku ?? '',
        inventory: normalized.inventory ? String(normalized.inventory) : '',
        status: normalized.status
      })
    } catch (err) {
      console.error('Failed to load product', err)
      setError(err instanceof Error ? err.message : 'Unable to load product details.')
    } finally {
      setLoading(false)
    }
  }, [isNew, productId])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  const handleFieldChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = event.target
      setForm((prev) => ({ ...prev, [name]: value }))
    },
    []
  )

  const resetVariantForm = useCallback(() => {
    setVariantForm({ name: '', sku: '', price: '', inventory: '' })
  }, [])

  const handleVariantFieldChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target
      setVariantForm((prev) => ({ ...prev, [name]: value }))
    },
    []
  )

  const handleEditingVariantChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target
      setEditingForm((prev) => ({ ...prev, [name]: value }))
    },
    []
  )

  const apiPayloadFromForm = useCallback(() => {
    const price = Number(form.price)
    const inventory = form.inventory ? Number(form.inventory) : undefined

    if (Number.isNaN(price) || price < 0) {
      throw new Error('Price must be a positive number.')
    }

    if (inventory !== undefined && (Number.isNaN(inventory) || inventory < 0)) {
      throw new Error('Inventory must be zero or greater.')
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      price,
      sku: form.sku.trim() || undefined,
      inventory,
      status: form.status
    }

    if (!payload.title) {
      throw new Error('Product title is required.')
    }

    return payload
  }, [form])

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      try {
        const payload = apiPayloadFromForm()
        setSaving(true)
        if (isNew) {
          const created = await apiFetch<ProductSummary>('/v1/products', {
            method: 'POST',
            body: payload
          })
          setMessage({ type: 'success', text: 'Product created' })
          capture('product_created', { productId: created.id, status: created.status })
          router.replace(`/catalog/${created.id}`)
          router.refresh()
        } else if (product) {
          const updated = await apiFetch<ProductSummary>(`/v1/products/${product.id}`, {
            method: 'PATCH',
            body: payload
          })
          const normalized = normalizeProduct(updated)
          setProduct(normalized)
          setMessage({ type: 'success', text: 'Product updated' })
          capture('product_updated', { productId: normalized.id, status: normalized.status })
        }
      } catch (err) {
        console.error('Failed to save product', err)
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Unable to save product.'
        })
      } finally {
        setSaving(false)
      }
    },
    [apiPayloadFromForm, isNew, product, router]
  )

  const handleDelete = useCallback(async () => {
    if (!product) return
    const confirmed = window.confirm('Archive this product?')
    if (!confirmed) return
    try {
      await apiFetch(`/v1/products/${product.id}`, { method: 'DELETE' })
      capture('product_deleted', { productId: product.id })
      router.push('/catalog')
    } catch (err) {
      console.error('Failed to delete product', err)
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to archive product.'
      })
    }
  }, [product, router])

  const handleAddVariant = useCallback(async () => {
    if (!product) return
    if (!variantForm.name.trim()) {
      setMessage({ type: 'error', text: 'Variant name is required.' })
      return
    }

    const price = variantForm.price ? Number(variantForm.price) : undefined
    const inventory = variantForm.inventory ? Number(variantForm.inventory) : undefined

    if (price !== undefined && (Number.isNaN(price) || price < 0)) {
      setMessage({ type: 'error', text: 'Variant price must be positive.' })
      return
    }

    if (inventory !== undefined && (Number.isNaN(inventory) || inventory < 0)) {
      setMessage({ type: 'error', text: 'Variant inventory must be zero or greater.' })
      return
    }

    try {
      const created = await apiFetch<ProductVariant>(`/v1/product-variants/${product.id}`, {
        method: 'POST',
        body: {
          name: variantForm.name.trim(),
          sku: variantForm.sku.trim() || undefined,
          price,
          inventory
        }
      })
      setVariants((prev) => [...prev, { ...created, price: created.price ?? null, inventory: created.inventory ?? 0 }])
      resetVariantForm()
      setMessage({ type: 'success', text: 'Variant added' })
      capture('product_variant_created', { productId: product.id, variantId: created.id })
    } catch (err) {
      console.error('Failed to add variant', err)
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to add variant.'
      })
    }
  }, [product, variantForm, resetVariantForm])

  const startEditingVariant = useCallback((variant: ProductVariant) => {
    setEditingVariant(variant)
    setEditingForm({
      name: variant.name,
      sku: variant.sku ?? '',
      price: variant.price !== null && variant.price !== undefined ? String(variant.price) : '',
      inventory: variant.inventory ? String(variant.inventory) : ''
    })
  }, [])

  const handleUpdateVariant = useCallback(async () => {
    if (!product || !editingVariant) return

    const price = editingForm.price ? Number(editingForm.price) : undefined
    const inventory = editingForm.inventory ? Number(editingForm.inventory) : undefined

    if (price !== undefined && (Number.isNaN(price) || price < 0)) {
      setMessage({ type: 'error', text: 'Variant price must be positive.' })
      return
    }

    if (inventory !== undefined && (Number.isNaN(inventory) || inventory < 0)) {
      setMessage({ type: 'error', text: 'Variant inventory must be zero or greater.' })
      return
    }

    try {
      const updated = await apiFetch<ProductVariant>(
        `/v1/product-variants/${product.id}/${editingVariant.id}`,
        {
          method: 'PATCH',
          body: {
            name: editingForm.name.trim() || editingVariant.name,
            sku: editingForm.sku.trim() || undefined,
            price,
            inventory
          }
        }
      )
      setVariants((prev) =>
        prev.map((variant) =>
          variant.id === editingVariant.id
            ? { ...variant, ...updated, price: updated.price ?? null, inventory: updated.inventory ?? 0 }
            : variant
        )
      )
      capture('product_variant_updated', { productId: product.id, variantId: editingVariant.id })
      setMessage({ type: 'success', text: 'Variant updated' })
      setEditingVariant(null)
    } catch (err) {
      console.error('Failed to update variant', err)
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update variant.'
      })
    }
  }, [product, editingVariant, editingForm])

  const handleDeleteVariant = useCallback(
    async (variantId: string) => {
      if (!product) return
      const confirmDelete = window.confirm('Delete this variant?')
      if (!confirmDelete) return
      try {
        await apiFetch(`/v1/product-variants/${product.id}/${variantId}`, { method: 'DELETE' })
        setVariants((prev) => prev.filter((variant) => variant.id !== variantId))
        capture('product_variant_deleted', { productId: product.id, variantId })
        setMessage({ type: 'success', text: 'Variant deleted' })
      } catch (err) {
        console.error('Failed to delete variant', err)
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Unable to delete variant.'
        })
      }
    },
    [product]
  )

  const handleFileSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!product) return
      const files = event.target.files
      if (!files || files.length === 0) return

      const uploads: ProductImage[] = []
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        try {
          const uploaded = await apiFetch<ProductImage>(`/v1/product-media/${product.id}`, {
            method: 'POST',
            body: formData
          })
          uploads.push(uploaded)
        } catch (err) {
          console.error('Failed to upload media', err)
          setMessage({
            type: 'error',
            text: err instanceof Error ? err.message : 'Unable to upload image.'
          })
        }
      }

      if (uploads.length) {
        setImages((prev) => [...prev, ...uploads].sort((a, b) => a.position - b.position))
        capture('product_images_uploaded', { productId: product.id, count: uploads.length })
        setMessage({ type: 'success', text: 'Image uploaded' })
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [product]
  )

  const handleDeleteImage = useCallback(
    async (imageId: string) => {
      if (!product) return
      try {
        await apiFetch(`/v1/product-media/${product.id}/${imageId}`, { method: 'DELETE' })
        setImages((prev) => prev.filter((image) => image.id !== imageId))
        capture('product_image_deleted', { productId: product.id, imageId })
        setMessage({ type: 'success', text: 'Image removed' })
      } catch (err) {
        console.error('Failed to delete image', err)
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Unable to remove image.'
        })
      }
    },
    [product]
  )

  const pageTitle = useMemo(() => {
    if (isNew) return 'Create product'
    if (product) return product.title
    return 'Product'
  }, [isNew, product])

  return (
    <div className="space-y-8">
      <nav className="text-xs text-slate-400">
        <Link href="/catalog" className="hover:text-emerald-200">
          ← Back to catalog
        </Link>
      </nav>

      <header className="flex flex-col gap-3 border-b border-slate-800 pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50">{pageTitle}</h1>
            <p className="mt-2 text-sm text-slate-300">
              {isNew
                ? 'Draft the essentials and publish when you are ready. Media and variants can be added after the first save.'
                : 'Update product details, manage variants, and refresh imagery in one place.'}
            </p>
          </div>
          {!isNew && (
            <div className="flex items-center gap-3">
              <span
                className={classNames(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                  product?.status === 'ACTIVE'
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
                )}
              >
                {product?.status === 'ACTIVE' ? 'Active' : 'Draft'}
              </span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-full border border-amber-400/60 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
              >
                Archive
              </button>
            </div>
          )}
        </div>

        {message ? (
          <div
            className={classNames(
              'rounded-xl border px-4 py-3 text-sm',
              message.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-400/40 bg-amber-500/10 text-amber-100'
            )}
          >
            {message.text}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading product…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
                <h2 className="text-lg font-semibold text-slate-50">Product details</h2>
                <div className="mt-4 grid gap-4">
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block font-medium text-slate-200">Title</span>
                    <input
                      name="title"
                      value={form.title}
                      onChange={handleFieldChange}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Everest Down Jacket"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block font-medium text-slate-200">Description</span>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleFieldChange}
                      rows={4}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Highlight materials, fit, and story."
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-slate-300">
                      <span className="mb-1 block font-medium text-slate-200">Price (NPR)</span>
                      <input
                        name="price"
                        value={form.price}
                        onChange={handleFieldChange}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      <span className="mb-1 block font-medium text-slate-200">Inventory</span>
                      <input
                        name="inventory"
                        value={form.inventory}
                        onChange={handleFieldChange}
                        type="number"
                        min="0"
                        step="1"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      <span className="mb-1 block font-medium text-slate-200">SKU</span>
                      <input
                        name="sku"
                        value={form.sku}
                        onChange={handleFieldChange}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        placeholder="SKU-001"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      <span className="mb-1 block font-medium text-slate-200">Status</span>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleFieldChange}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
                  </button>
                  {!isNew && product?.status !== form.status && (
                    <span className="text-xs text-slate-400">Status will update on save.</span>
                  )}
                </div>
              </div>
            </form>

            {!isNew && (
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-50">Variant builder</h2>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Capture size or color options and keep inventory accurate across combinations.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block font-medium text-slate-200">Name</span>
                    <input
                      name="name"
                      value={variantForm.name}
                      onChange={handleVariantFieldChange}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Large / Nepal"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block font-medium text-slate-200">SKU</span>
                    <input
                      name="sku"
                      value={variantForm.sku}
                      onChange={handleVariantFieldChange}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="SKU-001-L"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block font-medium text-slate-200">Price override</span>
                    <input
                      name="price"
                      value={variantForm.price}
                      onChange={handleVariantFieldChange}
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block font-medium text-slate-200">Inventory</span>
                    <input
                      name="inventory"
                      value={variantForm.inventory}
                      onChange={handleVariantFieldChange}
                      type="number"
                      min="0"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
                  >
                    Add variant
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {variants.length === 0 ? (
                    <p className="text-xs text-slate-500">No variants yet.</p>
                  ) : (
                    variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-50">{variant.name}</p>
                          <p className="text-xs text-slate-400">
                            SKU: {variant.sku ?? '—'} · Price: {variant.price !== undefined && variant.price !== null ? currencyFormatter.format(variant.price) : 'inherit'} · Inventory: {variant.inventory}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => startEditingVariant(variant)}
                            className="rounded-full border border-slate-700 px-3 py-1 font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(variant.id)}
                            className="rounded-full border border-amber-400/60 px-3 py-1 font-semibold text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {editingVariant && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="text-sm font-semibold text-slate-100">Edit variant</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs text-slate-300">
                        <span className="mb-1 block font-medium text-slate-200">Name</span>
                        <input
                          name="name"
                          value={editingForm.name}
                          onChange={handleEditingVariantChange}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        <span className="mb-1 block font-medium text-slate-200">SKU</span>
                        <input
                          name="sku"
                          value={editingForm.sku}
                          onChange={handleEditingVariantChange}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        <span className="mb-1 block font-medium text-slate-200">Price override</span>
                        <input
                          name="price"
                          value={editingForm.price}
                          onChange={handleEditingVariantChange}
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </label>
                      <label className="text-xs text-slate-300">
                        <span className="mb-1 block font-medium text-slate-200">Inventory</span>
                        <input
                          name="inventory"
                          value={editingForm.inventory}
                          onChange={handleEditingVariantChange}
                          type="number"
                          min="0"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUpdateVariant}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
                      >
                        Save variant
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingVariant(null)}
                        className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            {!isNew && (
              <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg shadow-black/20">
                <h2 className="text-lg font-semibold text-slate-50">Media library</h2>
                <p className="mt-2 text-xs text-slate-400">Upload product imagery to power storefront galleries and marketing cards.</p>
                <div className="mt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelection}
                    className="w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-3 py-3 text-xs text-slate-400 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950 hover:border-emerald-400"
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {images.length === 0 ? (
                    <p className="col-span-2 text-xs text-slate-500">No images yet.</p>
                  ) : (
                    images.map((image) => (
                      <figure key={image.id} className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                        <img src={image.url} alt={image.alt ?? ''} className="h-32 w-full object-cover" />
                        <figcaption className="p-2 text-xs text-slate-300">
                          {image.alt ?? 'Untitled image'}
                        </figcaption>
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(image.id)}
                          className="absolute right-2 top-2 hidden rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-slate-200 transition group-hover:flex"
                        >
                          Remove
                        </button>
                      </figure>
                    ))
                  )}
                </div>
              </section>
            )}

            {!isNew && product && (
              <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-lg shadow-black/20 text-sm text-slate-300">
                <h2 className="text-lg font-semibold text-slate-50">At a glance</h2>
                <ul className="mt-3 space-y-2 text-xs text-slate-400">
                  <li>ID: {product.id}</li>
                  <li>Created: {new Date(product.createdAt).toLocaleString()}</li>
                  <li>Last updated: {new Date(product.updatedAt).toLocaleString()}</li>
                  <li>Variants: {variants.length}</li>
                  <li>Images: {images.length}</li>
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

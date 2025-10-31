'use client'

import { useMemo, useState } from 'react'
import AddToCartButton from '../../../../components/cart/AddToCartButton'
import type { StorefrontProduct } from '../../../../lib/api'
import styles from './page.module.css'

type LocaleKey = 'en' | 'ne'

interface CopySchema {
  variants: string
  selectVariant: string
  variantLowStock: string
  variantSoldOut: string
  variantInStockTemplate: string
  youSaveTemplate: string
  description: string
  noDescription: string
  galleryAlt: string
}

const FORMAT_LOCALES: Record<LocaleKey, string> = {
  en: 'en-NP',
  ne: 'ne-NP'
}

interface ProductDetailClientProps {
  product: StorefrontProduct
  copy: CopySchema
  locale: LocaleKey
}

function formatCurrency(amount: number, currency = 'NPR', locale = 'en-NP') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount)
}

export default function ProductDetailClient({ product, copy, locale }: ProductDetailClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants.length > 0 ? product.variants[0]?.id ?? null : null
  )
  const [activeImage, setActiveImage] = useState<number>(0)

  const activeVariant = useMemo(
    () => product.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [product.variants, selectedVariantId]
  )

  const displayPrice = activeVariant?.price ?? product.price
  const formatterLocale = FORMAT_LOCALES[locale]
  const priceLabel = formatCurrency(displayPrice, 'NPR', formatterLocale)
  const comparePrice =
    activeVariant?.price && product.compareAtPrice && product.compareAtPrice > activeVariant.price
      ? product.compareAtPrice
      : product.compareAtPrice && product.compareAtPrice > product.price
        ? product.compareAtPrice
        : null

  const savings =
    comparePrice && comparePrice > displayPrice
      ? copy.youSaveTemplate.replace(
          '{amount}',
          formatCurrency(comparePrice - displayPrice, 'NPR', formatterLocale)
        )
      : null

  const variantInventory = activeVariant ? activeVariant.inventory : product.inventory.available
  const variantSku = activeVariant?.sku
  const variantLowStock =
    typeof variantInventory === 'number' && variantInventory > 0 && variantInventory <= 5
  const variantSoldOut = typeof variantInventory === 'number' ? variantInventory <= 0 : !product.available

  const formatStockMessage = (count: number | null | undefined) =>
    copy.variantInStockTemplate.replace(
      '{count}',
      (count ?? 0).toLocaleString(formatterLocale)
    )

  const galleryImages = product.images.length > 0 ? product.images : []
  const activeImageData = galleryImages[activeImage]

  return (
    <section className={styles.layout}>
      <div className={styles.gallery}>
        {activeImageData ? (
          <img
            src={activeImageData.url}
            alt={activeImageData.alt || copy.galleryAlt}
            className={styles.heroImage}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden>
            🛍️
          </div>
        )}
        {galleryImages.length > 1 ? (
          <div className={styles.thumbGrid}>
            {galleryImages.map((image, index) => {
              const isActive = index === activeImage
              return (
                <button
                  type="button"
                  key={`${image.url}-${index}`}
                  className={isActive ? styles.thumbButtonActive : styles.thumbButton}
                  onClick={() => setActiveImage(index)}
                  aria-pressed={isActive}
                >
                  <img src={image.url} alt={image.alt || copy.galleryAlt} />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className={styles.details}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{product.title}</h1>
          {variantSku ? <p className={styles.sku}>SKU: {variantSku}</p> : null}
        </div>

        <div className={styles.priceBlock}>
          <span className={styles.price}>{priceLabel}</span>
          {comparePrice ? (
            <span className={styles.priceCompare}>{formatCurrency(comparePrice, 'NPR', formatterLocale)}</span>
          ) : null}
          {savings ? <span className={styles.priceBadge}>{savings}</span> : null}
        </div>

        {variantSoldOut ? (
          <p className={`${styles.alert} ${styles.alertDanger}`}>{copy.variantSoldOut}</p>
        ) : variantLowStock ? (
          <p className={`${styles.alert} ${styles.alertWarning}`}>
            {copy.variantLowStock} {formatStockMessage(variantInventory)}
          </p>
        ) : (
          <p className={styles.stockInfo}>{formatStockMessage(variantInventory)}</p>
        )}

        {product.variants.length > 0 ? (
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionHeading}>{copy.variants}</h2>
            <p className={styles.variantHint}>{copy.selectVariant}</p>
            <div className={styles.variantPicker} role="list">
              {product.variants.map((variant) => {
                const isSelected = variant.id === selectedVariantId
                return (
                  <button
                    type="button"
                    key={variant.id}
                    role="listitem"
                    className={isSelected ? styles.variantOptionActive : styles.variantOption}
                    onClick={() => setSelectedVariantId(variant.id)}
                    aria-pressed={isSelected}
                    disabled={variant.inventory <= 0}
                  >
                    <span className={styles.variantName}>{variant.name}</span>
                    <span className={styles.variantPrice}>
                      {formatCurrency(variant.price, 'NPR', formatterLocale)}
                    </span>
                    <span className={styles.variantInventory}>
                      {variant.inventory > 0
                        ? formatStockMessage(variant.inventory)
                        : copy.variantSoldOut}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <AddToCartButton
          productId={product.id}
          variantId={selectedVariantId}
          disabled={variantSoldOut}
          className={styles.primaryButton}
        />

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionHeading}>{copy.description}</h2>
          <p className={styles.description}>
            {product.description ? product.description : copy.noDescription}
          </p>
        </section>

        {product.collections.length ? (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Collections</span>
            <span className={styles.metaValue}>{product.collections.join(', ')}</span>
          </div>
        ) : null}

        {product.tags.length ? (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Tags</span>
            <span className={styles.metaValue}>{product.tags.join(', ')}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

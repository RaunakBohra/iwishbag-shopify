import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  fetchStorefrontProductBySlug,
  StorefrontFetchError,
  StorefrontNotFoundError,
  type StorefrontProduct
} from '../../../../lib/api'
import styles from './page.module.css'
import ProductDetailClient from './ProductDetailClient'

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

type LocaleKey = 'en' | 'ne'

const COPY: Record<
  LocaleKey,
  {
    back: string
    description: string
    variants: string
    selectVariant: string
    noDescription: string
    lowStock: string
    soldOut: string
    localeLabel: string
    errorTitle: string
    errorMessage: string
    variantLowStock: string
    variantSoldOut: string
    variantInStockTemplate: string
    youSaveTemplate: string
    galleryAlt: string
  }
> = {
  en: {
    back: 'Back to products',
    description: 'Description',
    variants: 'Variants',
    selectVariant: 'Select an option',
    noDescription: 'No description available.',
    lowStock: 'Only a few left in stock!',
    soldOut: 'Currently sold out',
    localeLabel: 'Language',
    errorTitle: 'We had trouble loading this product',
    errorMessage: 'Please refresh the page or return to the catalog.',
    variantLowStock: 'Hurry! Only a few left.',
    variantSoldOut: 'This option is currently sold out.',
    variantInStockTemplate: '{count} in stock',
    youSaveTemplate: 'You save {amount}',
    galleryAlt: 'Product image'
  },
  ne: {
    back: 'उत्पादमा फर्कनुहोस्',
    description: 'विवरण',
    variants: 'भेरियन्टहरू',
    selectVariant: 'भेरियन्ट रोज्नुहोस्',
    noDescription: 'विवरण उपलब्ध छैन।',
    lowStock: 'थोरै मात्र बाँकी छ!',
    soldOut: 'हाल भण्डार उपलब्ध छैन',
    localeLabel: 'भाषा',
    errorTitle: 'यो उत्पादन लोड गर्दा समस्या आयो',
    errorMessage: 'कृपया पृष्ठ पुनः लोड गर्नुहोस् वा सूचीमा फर्कनुहोस्।',
    variantLowStock: 'छिटो लिनुहोस्! केही मात्र बाँकी छ।',
    variantSoldOut: 'यो विकल्प अहिले भण्डारमा छैन।',
    variantInStockTemplate: '{count} उपलब्ध',
    youSaveTemplate: '{amount} बचत',
    galleryAlt: 'उत्पादनको तस्वीर'
  }
}

function parseLocale(value: string | string[] | undefined): LocaleKey {
  if (typeof value === 'string' && value.toLowerCase() === 'ne') {
    return 'ne'
  }
  return 'en'
}

interface PageProps {
  params: { tenant: string; productSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const tenant = params.tenant
  const productSlug = params.productSlug

  const locale = parseLocale(searchParams.locale)
  const copy = COPY[locale]
  const baseQuery = new URLSearchParams()
  if (locale !== 'en') baseQuery.set('locale', locale)

  let product: StorefrontProduct | null
  try {
    product = await fetchStorefrontProductBySlug(tenant, productSlug)
  } catch (error) {
    if (error instanceof StorefrontNotFoundError) {
      notFound()
    }
    if (error instanceof StorefrontFetchError) {
      return (
        <div className={styles.errorPage} lang={locale}>
          <h1 className={styles.errorHeading}>{copy.errorTitle}</h1>
          <p className={styles.errorMessage}>{copy.errorMessage}</p>
          <Link href={`/${tenant}/products?${baseQuery.toString()}`} className={styles.backLink}>
            {copy.back}
          </Link>
        </div>
      )
    }
    throw error
  }

  if (!product) {
    notFound()
  }

  return (
    <div className={styles.page} lang={locale}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href={`/${tenant}/products?${baseQuery.toString()}`} className={styles.breadcrumbLink}>
          {copy.back}
        </Link>
        <div className={styles.localeSwitcher} role="group" aria-label={copy.localeLabel}>
          <Link
            href={`/${tenant}/products/${productSlug}`}
            className={classNames(styles.localeLink, locale === 'en' && styles.localeLinkActive)}
          >
            EN
          </Link>
          <Link
            href={`/${tenant}/products/${productSlug}?locale=ne`}
            className={classNames(styles.localeLink, locale === 'ne' && styles.localeLinkActive)}
          >
            ने
          </Link>
        </div>
      </nav>

      <ProductDetailClient
        product={product}
        copy={{
          variants: copy.variants,
          selectVariant: copy.selectVariant,
          description: copy.description,
          noDescription: copy.noDescription,
          variantLowStock: copy.variantLowStock,
          variantSoldOut: copy.variantSoldOut,
          variantInStockTemplate: copy.variantInStockTemplate,
          youSaveTemplate: copy.youSaveTemplate,
          galleryAlt: copy.galleryAlt
        }}
        locale={locale}
      />
    </div>
  )
}

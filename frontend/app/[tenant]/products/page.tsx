import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  StorefrontFetchError,
  StorefrontNotFoundError,
  fetchStorefrontProducts
} from '../../../lib/api'
import AddToCartButton from '../../../components/cart/AddToCartButton'
import styles from './page.module.css'

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

type LocaleKey = 'en' | 'ne'

type CopySchema = {
  heading: string
  subheading: string
  searchPlaceholder: string
  searchCta: string
  sortLabel: string
  applyCta: string
  inStockOnly: string
  empty: string
  errorTitle: string
  errorMessage: string
  summary: string
  next: string
  previous: string
  filters: string
  lowStock: string
  soldOut: string
  available: string
  rtl: boolean
}

const COPY: Record<LocaleKey, CopySchema> = {
  en: {
    heading: 'Explore products',
    subheading: 'Discover the latest arrivals and best sellers from our merchants.',
    searchPlaceholder: 'Search by name or SKU',
    searchCta: 'Search',
    sortLabel: 'Sort',
    applyCta: 'Apply',
    inStockOnly: 'In stock only',
    empty: 'No products found. Adjust filters or search again.',
    errorTitle: 'We ran into an issue',
    errorMessage: 'Products could not be loaded. Please refresh or come back in a moment.',
    summary: 'Showing {start}–{end} of {total} products',
    next: 'Next page',
    previous: 'Previous page',
    filters: 'Filters',
    lowStock: 'Low stock',
    soldOut: 'Sold out',
    available: 'Available',
    rtl: false
  },
  ne: {
    heading: 'नयाँ उत्पादहरू',
    subheading: 'हाम्रा व्यापारीका नयाँ तथा लोकप्रिय वस्तुहरू हेर्नुहोस्।',
    searchPlaceholder: 'नाम वा SKU बाट खोज्नुहोस्',
    searchCta: 'खोज्नुहोस्',
    sortLabel: 'क्रमबद्ध गर्नुहोस्',
    applyCta: 'लागू गर्नुहोस्',
    inStockOnly: 'भण्डारमा मात्र',
    empty: 'कुनै वस्तु भेटिएन। कृपया फिल्टर परिवर्तन गर्नुहोस्।',
    errorTitle: 'समस्या आयो',
    errorMessage: 'उत्पादहरू अहिले लोड गर्न सकिएनन्। केहीबेरपछि प्रयास गर्नुहोस्।',
    summary: 'कुल {total} वस्तुमध्ये {start}–{end} देखाउँदै',
    next: 'अर्को पृष्ठ',
    previous: 'अघिल्लो पृष्ठ',
    filters: 'फिल्टरहरू',
    lowStock: 'कम भण्डार',
    soldOut: 'भण्डार सकियो',
    available: 'उपलब्ध',
    rtl: false
  }
}

function parseLocale(value: string | string[] | undefined): LocaleKey {
  if (typeof value === 'string' && value.toLowerCase() === 'ne') {
    return 'ne'
  }
  return 'en'
}

function parseBoolean(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.includes('true')
  return value === 'true'
}

function formatSummary(locale: LocaleKey, start: number, end: number, total: number) {
  const copy = COPY[locale]
  const formatter = locale === 'ne' ? 'ne-NP' : 'en-NP'
  return copy.summary
    .replace('{start}', start.toLocaleString(formatter))
    .replace('{end}', end.toLocaleString(formatter))
    .replace('{total}', total.toLocaleString(formatter))
}

interface ProductGridProps {
  tenant: string
  locale: LocaleKey
  queryString: string
  products: Awaited<ReturnType<typeof fetchStorefrontProducts>>['data']
}

function ProductGrid({ tenant, locale, queryString, products }: ProductGridProps) {
  const t = COPY[locale]
  const detailHref = (slug: string) =>
    queryString ? `/${tenant}/products/${slug}?${queryString}` : `/${tenant}/products/${slug}`

  if (products.length === 0) {
    return <p className={styles.empty}>{t.empty}</p>
  }

  return (
    <div className={styles.grid}>
      {products.map((product) => {
        const firstImage = product.images[0]
        const lowStock = product.inventory.available > 0 && product.inventory.available <= 5
        const soldOut = !product.available
        const badgeLabel = soldOut ? t.soldOut : lowStock ? t.lowStock : undefined
        const compareAt = product.compareAtPrice ?? null
        const showCompare = compareAt !== null && compareAt > product.price
        const savingsPercent = showCompare && compareAt
          ? Math.round(((compareAt - product.price) / compareAt) * 100)
          : 0
        const savingsLabel =
          showCompare && savingsPercent > 0 ? `Save ${savingsPercent}%` : showCompare ? 'On sale' : null

        return (
          <article key={product.id} className={styles.card}>
            <Link href={detailHref(product.slug)} className={styles.imageLink}>
              {firstImage ? (
                <img src={firstImage.url} alt={firstImage.alt} className={styles.image} />
              ) : (
                <div className={styles.placeholder} aria-hidden>
                  🛍️
                </div>
              )}
              {badgeLabel ? (
                <span
                  className={classNames(
                    styles.badge,
                    soldOut ? styles.badgeDanger : styles.badgeWarning
                  )}
                >
                  {badgeLabel}
                </span>
              ) : null}
            </Link>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{product.title}</h3>
              <div className={styles.cardPrices}>
                <span className={styles.price}>NPR {product.price.toLocaleString('en-NP')}</span>
                {showCompare ? (
                  <>
                    <span className={styles.priceCompare}>
                      NPR {compareAt?.toLocaleString('en-NP')}
                    </span>
                    {savingsLabel ? <span className={styles.priceBadge}>{savingsLabel}</span> : null}
                  </>
                ) : null}
              </div>
              <p className={styles.inventory}>
                {soldOut ? t.soldOut : `${t.available}: ${product.inventory.available}`}
              </p>
              <div className={styles.actions}>
                <AddToCartButton
                  productId={product.id}
                  disabled={!product.available}
                  className={styles.addToCart}
                />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

interface PageProps {
  params: { tenant: string }
  searchParams: Record<string, string | string[] | undefined>
}

export const dynamic = 'force-dynamic'

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const tenant = params.tenant
  if (!tenant) {
    redirect('/')
  }

  const locale = parseLocale(searchParams.locale)
  const t = COPY[locale]
  const requestedPage = Number(searchParams.page ?? '1') || 1
  const page = Math.max(1, requestedPage)
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : undefined
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const inStock = parseBoolean(searchParams.inStock)

  const apiParams = new URLSearchParams({ page: String(page), pageSize: '24' })
  if (q) apiParams.set('q', q)
  if (sort) apiParams.set('sort', sort)
  if (inStock) apiParams.set('inStock', 'true')

  let data
  try {
    data = await fetchStorefrontProducts(tenant, apiParams)
  } catch (error) {
    if (error instanceof StorefrontNotFoundError) {
      notFound()
    }
    if (error instanceof StorefrontFetchError) {
      return (
        <div className={styles.errorPage}>
          <h1 className={styles.errorHeading}>{t.errorTitle}</h1>
          <p className={styles.errorMessage}>{t.errorMessage}</p>
        </div>
      )
    }
    throw error
  }

  const baseParams = new URLSearchParams()
  if (locale !== 'en') baseParams.set('locale', locale)
  if (sort) baseParams.set('sort', sort)
  if (inStock) baseParams.set('inStock', 'true')
  if (q) baseParams.set('q', q)

  const detailParams = new URLSearchParams(baseParams)
  if (data.meta.page > 1) {
    detailParams.set('page', String(data.meta.page))
  }

  const totalPages = Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))
  const currentPage = Math.min(data.meta.page, totalPages)
  const start = data.meta.total === 0 ? 0 : (currentPage - 1) * data.meta.pageSize + 1
  const end = data.meta.total === 0 ? 0 : Math.min(currentPage * data.meta.pageSize, data.meta.total)
  const summary = formatSummary(locale, start, end, data.meta.total)

  const hasPrevious = currentPage > 1
  const hasNext = data.meta.hasNextPage

  const previousParams = new URLSearchParams(baseParams)
  previousParams.set('page', String(Math.max(1, currentPage - 1)))

  const nextParams = new URLSearchParams(baseParams)
  nextParams.set('page', String(currentPage + 1))

  return (
    <div className={styles.page} lang={locale} dir={t.rtl ? 'rtl' : 'ltr'}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{tenant}</p>
          <h1 className={styles.heading}>{t.heading}</h1>
          <p className={styles.subheading}>{t.subheading}</p>
        </div>
        <div className={styles.localeSwitcher}>
          <Link
            href={`/${tenant}/products?${new URLSearchParams({
              ...Object.fromEntries(baseParams.entries()),
              locale: 'en'
            }).toString()}`}
            className={classNames(
              styles.localeSwitchLink,
              locale === 'en' && styles.localeSwitchLinkActive
            )}
          >
            EN
          </Link>
          <Link
            href={`/${tenant}/products?${new URLSearchParams({
              ...Object.fromEntries(baseParams.entries()),
              locale: 'ne'
            }).toString()}`}
            className={classNames(
              styles.localeSwitchLink,
              locale === 'ne' && styles.localeSwitchLinkActive
            )}
          >
            ने
          </Link>
        </div>
      </header>

      <section className={styles.controls}>
        <form className={styles.searchForm}>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className={styles.searchInput}
          />
          <input type="hidden" name="locale" value={locale} />
          {sort ? <input type="hidden" name="sort" value={sort} /> : null}
          {inStock ? <input type="hidden" name="inStock" value="true" /> : null}
          <input type="hidden" name="page" value="1" />
          <button type="submit" className={styles.searchButton}>
            {t.searchCta}
          </button>
        </form>
        <div className={styles.filters}>
          <form className={styles.inlineForm} aria-label={t.filters}>
            <input type="hidden" name="locale" value={locale} />
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input type="hidden" name="page" value="1" />
            <label>
              {t.sortLabel}
              <select name="sort" defaultValue={sort ?? 'relevance'}>
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" name="inStock" value="true" defaultChecked={inStock} />
              {t.inStockOnly}
            </label>
            <button type="submit" className={styles.inlineFormButton}>
              {t.applyCta}
            </button>
          </form>
        </div>
      </section>

      <p className={styles.summary} role="status">
        {summary}
      </p>
      <ProductGrid tenant={tenant} locale={locale} queryString={detailParams.toString()} products={data.data} />

      <nav className={styles.pagination} aria-label="Pagination">
        <Link
          className={classNames(styles.pager, !hasPrevious && styles.pagerDisabled)}
          href={`/${tenant}/products?${previousParams.toString()}`}
          aria-disabled={!hasPrevious}
        >
          {t.previous}
        </Link>
        <span className={styles.pageIndicator}>
          {currentPage} / {totalPages}
        </span>
        <Link
          className={classNames(styles.pager, !hasNext && styles.pagerDisabled)}
          href={`/${tenant}/products?${nextParams.toString()}`}
          aria-disabled={!hasNext}
          prefetch={hasNext}
        >
          {t.next}
        </Link>
      </nav>

    </div>
  )
}

import { notFound, redirect } from 'next/navigation'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT

export default function Home() {
  if (DEFAULT_TENANT && DEFAULT_TENANT.trim().length > 0) {
    redirect(`/${DEFAULT_TENANT}/products`)
  }

  notFound()
}

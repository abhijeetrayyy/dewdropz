import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomizerStudio from '@/components/customize/CustomizerStudio'
import { getProductBySlug } from '@/actions/products'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return {}
  return { title: `Customize ${product.name} — DEWDROPZ` }
}

export default async function CustomizeProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ variant?: string }>
}) {
  const { slug } = await params
  const { variant } = await searchParams
  const product = await getProductBySlug(slug)
  if (!product || !product.is_customizable) notFound()

  return <CustomizerStudio product={product} initialVariantId={variant} />
}

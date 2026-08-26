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
  // `start` is which of the two doors the visitor came through — the brief's
  // "select from our pre-set design ready library" versus "upload their own
  // design". Only 'library' does anything; anything else lands on the blank
  // canvas, which is what the studio has always opened on.
  searchParams: Promise<{ variant?: string; color?: string; start?: string }>
}) {
  const { slug } = await params
  const { variant, color, start } = await searchParams
  const product = await getProductBySlug(slug)
  if (!product || !product.is_customizable) notFound()

  return (
    <CustomizerStudio
      product={product}
      initialVariantId={variant}
      initialColorName={color}
      openLibrary={start === 'library'}
    />
  )
}

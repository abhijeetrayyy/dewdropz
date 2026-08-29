import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomizerStudio from '@/components/customize/CustomizerStudio'
import { getProductBySlug, getProducts } from '@/actions/products'

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
  const [product, all] = await Promise.all([getProductBySlug(slug), getProducts()])
  if (!product || !product.is_customizable) notFound()

  // The other blanks, so the garment can be changed without leaving. Same
  // filter the /customize index uses: customizable AND actually set up with
  // colourways, because a blank with no zones opens a studio with nothing in it.
  const blanks = all
    .filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)
    .map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, images: p.images }))

  return (
    <CustomizerStudio
      product={product}
      blanks={blanks}
      initialVariantId={variant}
      initialColorName={color}
      openLibrary={start === 'library'}
    />
  )
}

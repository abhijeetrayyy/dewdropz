'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { Canvas } from 'fabric'
import { toast } from 'sonner'
import CanvasStage from './CanvasStage'
import Toolbar from './Toolbar'
import { useCart } from '@/providers/CartProvider'
import { uploadCustomerImage } from '@/actions/media'
import { saveCustomDesign } from '@/actions/designs'
import { compositePreview, dataUrlToFile } from '@/lib/customize/compositePreview'
import type { ProductWithCollection, Json } from '@/types/database'

type Side = 'front' | 'back'

export default function CustomizerStudio({
  product,
  initialVariantId,
}: {
  product: ProductWithCollection
  initialVariantId?: string
}) {
  const router = useRouter()
  const { addItem } = useCart()
  const config = product.customization_config
  const sides = (['front', 'back'] as Side[]).filter((s) => config?.[s])
  const [activeSide, setActiveSide] = useState<Side>(sides[0] ?? 'front')
  const [frontCanvas, setFrontCanvas] = useState<Canvas | null>(null)
  const [backCanvas, setBackCanvas] = useState<Canvas | null>(null)
  const [saving, setSaving] = useState(false)

  const variants = product.variants ?? []
  const [variantId, setVariantId] = useState(
    (initialVariantId && variants.find((v) => v.id === initialVariantId)?.id) || variants[0]?.id || ''
  )
  const variant = variants.find((v) => v.id === variantId)
  const price = product.price + (variant?.price_adjustment ?? 0)

  const activeCanvas = activeSide === 'front' ? frontCanvas : backCanvas

  if (sides.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6 text-center">
        <p className="font-body text-mid">This product isn&apos;t set up for customization yet.</p>
      </div>
    )
  }

  async function handleContinue() {
    const hasContent = (frontCanvas?.getObjects().length ?? 0) > 0 || (backCanvas?.getObjects().length ?? 0) > 0
    if (!hasContent) {
      toast.error('Add some text or an image before continuing.')
      return
    }
    if (variants.length > 0 && !variantId) {
      toast.error('Pick a size first.')
      return
    }

    setSaving(true)
    try {
      const payload: {
        front_design?: Json
        back_design?: Json
        front_preview_url?: string
        back_preview_url?: string
        front_print_url?: string
        back_print_url?: string
      } = {}
      let cartImage = product.images?.[0] ?? ''

      for (const side of sides) {
        const canvas = side === 'front' ? frontCanvas : backCanvas
        const zone = config?.[side]
        if (!canvas || !zone || canvas.getObjects().length === 0) continue

        const designDataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
        const previewDataUrl = await compositePreview(zone, designDataUrl)

        const [printUrl, previewUrl] = await Promise.all([
          uploadCustomerImage(dataUrlToFile(designDataUrl, `${side}-print.png`)),
          uploadCustomerImage(dataUrlToFile(previewDataUrl, `${side}-preview.png`)),
        ])

        payload[`${side}_design`] = canvas.toJSON() as unknown as Json
        payload[`${side}_print_url`] = printUrl
        payload[`${side}_preview_url`] = previewUrl
        if (side === sides[0]) cartImage = previewUrl
      }

      const result = await saveCustomDesign({
        product_id: product.id,
        variant_id: variantId || null,
        ...payload,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      addItem(
        {
          slug: product.slug,
          name: product.name,
          price,
          image: cartImage,
          size: variant?.name ?? '',
          productId: product.id,
          variantId: variantId || null,
          customDesignId: result.designId,
        },
        1
      )

      toast.success('Added your design to the cart')
      router.push('/cart')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your design')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-rule px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
        <Link
          href={`/products/${product.slug}`}
          className="flex items-center gap-1.5 font-body text-xs text-mid hover:text-forest transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back</span>
        </Link>
        <h1 className="font-display font-light text-base sm:text-lg text-text truncate text-center">
          Customize {product.name}
        </h1>
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="flex-shrink-0 flex items-center gap-1.5 bg-forest text-paper px-4 sm:px-5 py-2 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </header>

      <div className="flex flex-col items-center gap-3 py-4 flex-shrink-0">
        {sides.length > 1 && (
          <div className="flex justify-center gap-2">
            {sides.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSide(s)}
                className={`px-5 py-2 text-xs font-body tracking-[0.08em] uppercase rounded-sm border transition-colors duration-300 ${
                  activeSide === s
                    ? 'bg-forest text-paper border-forest'
                    : 'border-rule text-mid hover:border-forest hover:text-forest'
                }`}
              >
                {s === 'front' ? 'Front' : 'Back'}
              </button>
            ))}
          </div>
        )}

        {variants.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-body text-[10px] tracking-[0.15em] text-mid uppercase">Size</span>
            {variants.map((v) => {
              const oos = (v.inventory_quantity ?? 0) <= 0
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={oos}
                  onClick={() => setVariantId(v.id)}
                  className={`px-3 py-1.5 text-xs font-body tracking-[0.05em] uppercase rounded-sm border transition-colors duration-300 ${
                    variantId === v.id
                      ? 'bg-forest text-paper border-forest'
                      : oos
                      ? 'border-rule text-light/50 cursor-not-allowed line-through'
                      : 'border-rule text-mid hover:border-forest hover:text-forest'
                  }`}
                >
                  {v.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 grid md:grid-cols-[1fr_320px]">
        <div className="p-6 flex items-center justify-center min-h-[50vh]">
          {config?.front && <CanvasStage zone={config.front} active={activeSide === 'front'} onReady={setFrontCanvas} />}
          {config?.back && <CanvasStage zone={config.back} active={activeSide === 'back'} onReady={setBackCanvas} />}
        </div>
        <Toolbar canvas={activeCanvas} />
      </div>
    </div>
  )
}

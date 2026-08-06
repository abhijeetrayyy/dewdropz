import type { CustomizationZone } from '@/types/database'

const CANONICAL_WIDTH = 800

function loadImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

// Composites a design (a transparent-background PNG data URL, exactly what
// the print zone's Fabric canvas exports) onto its mockup photo at the
// zone's authored position — turning "a logo floating on nothing" into "a
// shirt with your design on it" for cart/order thumbnails. Print-resolution
// export is a separate concern (Step 5); this is display-quality only.
export async function compositePreview(zone: CustomizationZone, designDataUrl: string): Promise<string> {
  const [mockup, design] = await Promise.all([
    loadImage(zone.mockupImage, 'anonymous'),
    loadImage(designDataUrl),
  ])

  const height = Math.round((mockup.naturalHeight / mockup.naturalWidth) * CANONICAL_WIDTH)
  const canvas = document.createElement('canvas')
  canvas.width = CANONICAL_WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(mockup, 0, 0, CANONICAL_WIDTH, height)
  ctx.drawImage(design, zone.x, zone.y, zone.widthPx, zone.heightPx)

  return canvas.toDataURL('image/png')
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

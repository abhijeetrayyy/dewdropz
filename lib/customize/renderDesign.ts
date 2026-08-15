import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas'
import type { CustomizationZone } from '@/types/database'
import { scaleForZone, dpiForScale, outputSize } from './printSpec'

// The zone coordinate space every design is authored in. Mobile stores layer
// positions in these units, so rendering is a pure scale-up from here.
const CANONICAL_WIDTH = 800

// Print scale is no longer a constant here. It was `PRINT_SCALE = 4`, which had
// nothing to do with the print size it was producing: on the tee's 212px zone
// that made an 849px file for a 12-inch print — 71 DPI, and unusable. It now
// comes from the zone's physical dimensions via printSpec, the same rule the
// web studio follows.

// The mobile studio renders text with these exact TTFs (vendored from the same
// @expo-google-fonts packages the app bundles), so server output matches what
// the shopper actually saw. Registering under distinct family names avoids
// colliding with any system font of the same name.
const FONTS: { file: string; family: string }[] = [
  { file: 'Inter_400Regular.ttf', family: 'StudioSans' },
  { file: 'Inter_600SemiBold.ttf', family: 'StudioSansBold' },
  { file: 'Fraunces_400Regular.ttf', family: 'StudioSerif' },
  { file: 'Fraunces_400Regular_Italic.ttf', family: 'StudioSerifItalic' },
  { file: 'Fraunces_600SemiBold.ttf', family: 'StudioSerifBold' },
  { file: 'Fraunces_600SemiBold_Italic.ttf', family: 'StudioSerifBoldItalic' },
  { file: 'SpaceMono_400Regular.ttf', family: 'StudioMono' },
  { file: 'SpaceMono_400Regular_Italic.ttf', family: 'StudioMonoItalic' },
  { file: 'SpaceMono_700Bold.ttf', family: 'StudioMonoBold' },
]

let fontsReady = false
function ensureFonts() {
  if (fontsReady) return
  for (const f of FONTS) {
    GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets', 'fonts', f.file), f.family)
  }
  fontsReady = true
}

// Maps the studio's font choice + bold/italic to a registered family. Inter
// ships no italic in the app's font package, so italic sans deliberately falls
// back to upright rather than letting the rasterizer synthesise a slant that
// the phone never showed.
function familyFor(fontFamily: string, bold: boolean, italic: boolean): string {
  if (fontFamily.startsWith('Fraunces')) {
    if (bold) return italic ? 'StudioSerifBoldItalic' : 'StudioSerifBold'
    return italic ? 'StudioSerifItalic' : 'StudioSerif'
  }
  if (fontFamily.startsWith('SpaceMono')) {
    if (bold) return 'StudioMonoBold'
    return italic ? 'StudioMonoItalic' : 'StudioMono'
  }
  return bold ? 'StudioSansBold' : 'StudioSans'
}

export type RenderLayer =
  | {
      kind: 'text'
      text: string
      fontFamily: string
      fontSize: number
      color: string
      bold: boolean
      italic: boolean
      x: number
      y: number
      scale: number
      rotation: number
    }
  | {
      kind: 'image'
      uri: string
      width: number
      height: number
      x: number
      y: number
      scale: number
      rotation: number
    }

async function fetchImage(uri: string) {
  // Only http(s) is accepted: layer image URIs come from our own storage after
  // upload, and following file:// or data: here would let a client push the
  // server at its own filesystem.
  if (!/^https?:\/\//i.test(uri)) throw new Error('Unsupported image source')
  const res = await fetch(uri)
  if (!res.ok) throw new Error(`Could not fetch layer image (${res.status})`)
  return loadImage(Buffer.from(await res.arrayBuffer()))
}

// Draws one layer with its own transform. Rotation is applied about the
// layer's top-left, matching how the mobile renderer composes
// translate -> scale -> rotate, so a rotated design lands identically.
async function drawLayer(ctx: SKRSContext2D, layer: RenderLayer, scale: number) {
  ctx.save()
  ctx.translate(layer.x * scale, layer.y * scale)
  ctx.rotate((layer.rotation * Math.PI) / 180)
  ctx.scale(layer.scale, layer.scale)

  if (layer.kind === 'text') {
    const size = layer.fontSize * scale
    ctx.font = `${size}px "${familyFor(layer.fontFamily, layer.bold, layer.italic)}"`
    ctx.fillStyle = layer.color
    // React Native anchors a <Text> box by its top edge; canvas defaults to the
    // alphabetic baseline. Without this the print would sit a full ascent high.
    ctx.textBaseline = 'top'
    ctx.fillText(layer.text, 0, 0)
  } else {
    const img = await fetchImage(layer.uri)
    ctx.drawImage(img, 0, 0, layer.width * scale, layer.height * scale)
  }

  ctx.restore()
}

// The artwork alone on transparency — this is the file that goes to the printer.
export async function renderPrint(
  zone: CustomizationZone,
  layers: RenderLayer[]
): Promise<{ buffer: Buffer; dpi: number; widthPx: number; heightPx: number }> {
  ensureFonts()
  const scale = scaleForZone(zone)
  const { widthPx, heightPx } = outputSize(zone, scale)

  const canvas = createCanvas(widthPx, heightPx)
  const ctx = canvas.getContext('2d')
  for (const layer of layers) await drawLayer(ctx, layer, scale)

  return {
    buffer: canvas.toBuffer('image/png'),
    dpi: dpiForScale(zone, scale),
    widthPx,
    heightPx,
  }
}

// The same artwork composited over the garment photo, clipped to the print
// zone — the cart and order thumbnail. Rendered at the canonical width so
// mobile previews match the web studio's 800px-wide ones.
export async function renderPreview(
  zone: CustomizationZone,
  layers: RenderLayer[],
  mockup: { localPath?: string; url?: string }
): Promise<Buffer> {
  ensureFonts()

  const source = mockup.localPath
    ? await loadImage(await readFile(mockup.localPath))
    : await fetchImage(mockup.url!)

  const height = Math.round((source.height / source.width) * CANONICAL_WIDTH)
  const canvas = createCanvas(CANONICAL_WIDTH, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, CANONICAL_WIDTH, height)

  // Clip so a layer dragged past the print boundary is cut off in the preview
  // exactly as it is in the studio and in the print file.
  ctx.save()
  ctx.beginPath()
  ctx.rect(zone.x, zone.y, zone.widthPx, zone.heightPx)
  ctx.clip()
  ctx.translate(zone.x, zone.y)
  for (const layer of layers) await drawLayer(ctx, layer, 1)
  ctx.restore()

  return canvas.toBuffer('image/png')
}

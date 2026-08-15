import Image from 'next/image'
import { parseDesign, hasArtwork } from '@/lib/designSpec'
import { TARGET_DPI, MIN_DPI } from '@/lib/customize/printSpec'
import { Download, FileWarning, AlertTriangle } from 'lucide-react'

type Design = {
  id: string
  front_preview_url: string | null
  back_preview_url: string | null
  front_print_url: string | null
  back_print_url: string | null
  front_print_dpi: number | null
  back_print_dpi: number | null
  front_design: unknown
  back_design: unknown
}

// Everything the person printing a shirt needs, in one block: what it looks
// like, the file to send to the press, and a written spec of what is on it.
//
// The spec matters because a preview is a picture — it cannot tell you the font
// is Inter at 24px in #1a1a1a, and that is exactly what has to be reproduced
// when the print file has to be rebuilt or colour-matched.
function Side({
  label, previewUrl, printUrl, printDpi, design, itemId, side,
}: {
  label: string
  previewUrl: string | null
  printUrl: string | null
  printDpi: number | null
  design: unknown
  itemId?: string
  side: 'front' | 'back'
}) {
  const elements = parseDesign(design)
  if (!hasArtwork(design) && !printUrl && !previewUrl) return null

  // Below MIN_DPI a DTG print visibly softens. Said here, at the moment someone
  // is about to send the file, rather than discovered on a garment.
  const lowQuality = printDpi != null && printDpi < MIN_DPI
  const belowTarget = printDpi != null && printDpi >= MIN_DPI && printDpi < TARGET_DPI

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900">{label}</h4>
          {printUrl && (
            <p className="mt-0.5 text-[11px] text-gray-500">
              {printDpi != null ? (
                <>
                  {printDpi} DPI
                  {lowQuality && <span className="text-red-700"> — below print standard</span>}
                  {belowTarget && <span className="text-amber-700"> — under {TARGET_DPI} DPI</span>}
                </>
              ) : (
                // Files made before the resolution was recorded. Saying so is
                // better than showing a number that might be a guess.
                <span className="text-amber-700">Resolution not recorded — check before printing</span>
              )}
            </p>
          )}
        </div>

        {printUrl && itemId ? (
          <a
            href={`/api/admin/print-file/${itemId}/${side}`}
            // Same-origin, so this actually downloads. Linking straight at
            // storage meant the browser ignored `download` and opened the PNG
            // in a tab instead.
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            <Download className="h-3.5 w-3.5" /> Print file
          </a>
        ) : printUrl ? (
          <a
            href={printUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-900"
          >
            <Download className="h-3.5 w-3.5" /> Open file
          </a>
        ) : (
          // Said out loud rather than left as a missing button: a custom line
          // with no print file cannot be produced, and finding that out at the
          // press is worse than finding out here.
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-amber-700">
            <FileWarning className="h-3.5 w-3.5" /> No print file
          </span>
        )}
      </div>

      {lowQuality && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <p className="text-xs text-red-800">
            This file is {printDpi} DPI at full print size. It will look soft or pixelated on the
            garment — ask the customer for larger artwork, or re-export the design, before printing.
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-4">
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-28 w-28 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 hover:border-gray-400"
          >
            <Image
              src={previewUrl}
              alt={`${label} preview`}
              width={112}
              height={112}
              className="h-full w-full object-contain"
              unoptimized
            />
          </a>
        )}

        <div className="min-w-0 flex-1">
          {elements.length === 0 ? (
            <p className="text-xs text-gray-400">No artwork recorded on this side.</p>
          ) : (
            <ul className="space-y-2">
              {elements.map((el, i) => (
                <li key={i} className="text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                      {el.kind}
                    </span>
                    <span className="min-w-0 break-words font-medium text-gray-900">
                      {el.kind === 'image' ? (
                        <a href={el.content} target="_blank" rel="noopener noreferrer" className="underline">
                          source image
                        </a>
                      ) : (
                        `“${el.content}”`
                      )}
                    </span>
                  </div>
                  {(el.details.length > 0 || el.position) && (
                    <div className="mt-0.5 pl-1 text-gray-500">
                      {[...el.details, el.position].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DesignPanel({ design, itemId }: { design: Design | null; itemId?: string }) {
  if (!design) return null
  return (
    <div className="space-y-3">
      <Side
        label="Front" side="front" itemId={itemId}
        previewUrl={design.front_preview_url}
        printUrl={design.front_print_url}
        printDpi={design.front_print_dpi}
        design={design.front_design}
      />
      <Side
        label="Back" side="back" itemId={itemId}
        previewUrl={design.back_preview_url}
        printUrl={design.back_print_url}
        printDpi={design.back_print_dpi}
        design={design.back_design}
      />
    </div>
  )
}

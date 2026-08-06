'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { uploadAdminImage, deleteAdminImage, type MediaBucket } from '@/actions/media'
import { Upload, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

export function ImageUploader({
  bucket,
  value,
  onChange,
  multiple = true,
  maxFiles = 8,
}: {
  bucket: MediaBucket
  value: string[]
  onChange: (urls: string[]) => void
  multiple?: boolean
  maxFiles?: number
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = multiple ? maxFiles - value.length : 1
    const toUpload = Array.from(files).slice(0, Math.max(0, remaining))
    if (toUpload.length === 0) {
      toast.error(multiple ? `Maximum ${maxFiles} images` : 'Remove the current image first')
      return
    }
    setUploading(true)
    try {
      const uploaded = await Promise.all(toUpload.map((f) => uploadAdminImage(bucket, f)))
      onChange(multiple ? [...value, ...uploaded] : uploaded)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove(url: string) {
    onChange(value.filter((u) => u !== url))
    try {
      await deleteAdminImage(bucket, url)
    } catch {
      // The URL is already gone from this record's `value` either way — a failed
      // storage delete just leaves an orphaned file in the bucket, not a broken UI.
      toast.error('Removed from product, but the file may still exist in storage')
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, index) => (
          <div key={url} className="relative h-20 w-20 rounded-sm overflow-hidden border border-gray-200 group">
            <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            {index === 0 && (
              <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm">
                Cover
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="flex items-center justify-center"
                aria-label="Remove image"
              >
                <X className="h-5 w-5 text-white" />
              </button>
              {value.length > 1 && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                    className="disabled:opacity-30"
                    aria-label="Move image earlier"
                  >
                    <ChevronLeft className="h-4 w-4 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === value.length - 1}
                    className="disabled:opacity-30"
                    aria-label="Move image later"
                  >
                    <ChevronRight className="h-4 w-4 text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {(multiple ? value.length < maxFiles : value.length === 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-20 w-20 rounded-sm border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-gray-400">JPEG, PNG, WebP or AVIF, up to 5MB{multiple ? ` — max ${maxFiles} images` : ''}.</p>
    </div>
  )
}

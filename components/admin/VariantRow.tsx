'use client'

import { useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { deleteVariant, updateVariant } from '@/actions/variants'
import type { VariantWithOptions } from '@/types/database'

export function VariantRow({
  variant,
  variants,
  onChange,
}: {
  variant: VariantWithOptions
  variants: VariantWithOptions[]
  onChange: (variants: VariantWithOptions[]) => void
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  const debouncedSave = useCallback((field: string, value: string) => {
    if (timers.current[field]) clearTimeout(timers.current[field])
    timers.current[field] = setTimeout(() => {
      const numFields = ['price_adjustment', 'inventory_quantity', 'low_stock_threshold']
      let finalValue: string | number = value
      if (numFields.includes(field)) {
        const parsed = parseInt(value)
        finalValue = isNaN(parsed) ? 0 : parsed
      }
      updateVariant(variant.id, { [field]: finalValue })
    }, 400)
  }, [variant.id])

  const update = (field: string, value: string) => {
    const numFields = ['price_adjustment', 'inventory_quantity', 'low_stock_threshold']
    const parsed = numFields.includes(field) ? (parseInt(value) || 0) : value
    const newValue = numFields.includes(field) ? (isNaN(parseInt(value)) ? 0 : parseInt(value)) : value
    const nv = variants.map((x) => x.id === variant.id ? { ...x, [field]: newValue } : x)
    onChange(nv)
    debouncedSave(field, value)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete variant "${variant.name}"? This cannot be undone.`)) return
    try {
      await deleteVariant(variant.id)
      onChange(variants.filter((x) => x.id !== variant.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete variant')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-gray-900">{variant.name}</TableCell>
      <TableCell>
        <Input className="h-7 w-28 text-xs" value={variant.sku ?? ''} onChange={(e) => update('sku', e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="h-7 w-20 text-xs text-right" type="number" value={variant.price_adjustment ?? 0} onChange={(e) => update('price_adjustment', e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className={`h-7 w-16 text-xs text-right ${(variant.inventory_quantity ?? 0) <= (variant.low_stock_threshold ?? 5) ? 'text-amber-600' : ''}`} type="number" value={variant.inventory_quantity ?? 0} onChange={(e) => update('inventory_quantity', e.target.value)} />
      </TableCell>
      <TableCell>
        <Input className="h-7 w-16 text-xs text-right text-gray-400" type="number" value={variant.low_stock_threshold ?? 5} onChange={(e) => update('low_stock_threshold', e.target.value)} />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-red-600 h-7 w-7">×</Button>
      </TableCell>
    </TableRow>
  )
}

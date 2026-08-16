'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { EditableNumber } from '@/components/admin/EditableNumber'
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
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const t = timers.current
    return () => { Object.values(t).forEach(clearTimeout) }
  }, [])

  // Text fields only. The numeric columns go through EditableNumber, which
  // knows the difference between "empty while being retyped" and "zero" — the
  // distinction this row used to get wrong, saving 0 for any field the user
  // cleared before typing the replacement.
  const saveText = useCallback((field: string, value: string) => {
    if (timers.current[field]) clearTimeout(timers.current[field])
    timers.current[field] = setTimeout(async () => {
      try {
        await updateVariant(variant.id, { [field]: value })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save')
      }
    }, 500)
  }, [variant.id])

  function patchLocal(field: string, value: string | number) {
    onChange(variants.map((x) => (x.id === variant.id ? { ...x, [field]: value } : x)))
  }

  async function commitNumber(field: string, value: number) {
    await updateVariant(variant.id, { [field]: value })
    patchLocal(field, value)
  }

  async function handleDelete() {
    setConfirmDelete(false)
    try {
      await deleteVariant(variant.id)
      onChange(variants.filter((x) => x.id !== variant.id))
      toast.success('Variant deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete variant')
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="px-3 py-2">
          <span className="block truncate font-medium text-gray-900">{variant.name}</span>
        </TableCell>
        <TableCell className="px-3 py-2">
          <Input
            className="h-8 w-full font-mono text-xs"
            aria-label={`SKU for ${variant.name}`}
            defaultValue={variant.sku ?? ''}
            onChange={(e) => saveText('sku', e.target.value)}
          />
        </TableCell>
        <TableCell className="px-3 py-2">
          <EditableNumber
            mode="rupees"
            value={(variant.price_adjustment ?? 0) / 100}
            ariaLabel={`Price adjustment for ${variant.name}`}
            onCommit={(rupees) => commitNumber('price_adjustment', Math.round(rupees * 100))}
          />
        </TableCell>
        <TableCell className="px-3 py-2">
          <EditableNumber
            mode="integer"
            value={variant.inventory_quantity ?? 0}
            ariaLabel={`Stock for ${variant.name}`}
            onCommit={(next) => commitNumber('inventory_quantity', next)}
            className={
              (variant.inventory_quantity ?? 0) <= 0
                ? '[&_input]:text-red-600'
                : (variant.inventory_quantity ?? 0) <= (variant.low_stock_threshold ?? 5)
                  ? '[&_input]:text-amber-600'
                  : ''
            }
          />
        </TableCell>
        <TableCell className="px-3 py-2">
          <EditableNumber
            mode="integer"
            value={variant.low_stock_threshold ?? 5}
            ariaLabel={`Low stock threshold for ${variant.name}`}
            onCommit={(next) => commitNumber('low_stock_threshold', next)}
            className="[&_input]:text-gray-500"
          />
        </TableCell>
        <TableCell className="px-3 py-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              className="h-8 w-8 text-red-600"
              title={`Delete ${variant.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete variant "${variant.name}"?`}
        description="Its stock and SKU go with it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}

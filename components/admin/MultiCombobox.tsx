'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  depth?: number
}

export function MultiCombobox({
  options,
  selected,
  onChange,
  placeholder = 'Search...',
  emptyText = 'Nothing found.',
}: {
  options: ComboboxOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const selectedOptions = options.filter((o) => selected.includes(o.value))

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-gray-500"
          >
            {selected.length > 0 ? `${selected.length} selected` : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <Check className={cn('mr-2 h-4 w-4', selected.includes(o.value) ? 'opacity-100' : 'opacity-0')} />
                    <span style={o.depth ? { paddingLeft: `${o.depth * 14}px` } : undefined}>{o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <Badge key={o.value} variant="secondary" className="gap-1 pr-1 font-normal">
              {o.label}
              <button type="button" onClick={() => toggle(o.value)} className="rounded-full hover:bg-gray-300/60 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { getDeliveryEstimate } from '@/actions/shipping'
import { formatPrice } from '@/lib/utils'

type Result =
  | { serviceable: true; state: string; cost: number; minDays: number | null; maxDays: number | null }
  | { serviceable: false; error: string }

export default function ProductDeliveryCheck({ subtotal, weightGrams }: { subtotal: number; weightGrams: number }) {
  const [pincode, setPincode] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    if (checking) return
    setChecking(true)
    setResult(null)
    try {
      const res = await getDeliveryEstimate({ pincode, subtotal, weightGrams })
      setResult(res)
    } catch {
      setResult({ serviceable: false, error: 'Could not check delivery right now — try again.' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mt-6 max-w-md">
      <div className="font-body text-[10px] tracking-[0.15em] text-text uppercase mb-2">Check Delivery</div>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="Enter pincode"
          className="flex-1 border border-rule rounded-[var(--r-input)] px-3 py-2 text-sm font-body text-text focus:outline-none focus:border-forest transition-colors"
        />
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking || pincode.length !== 6}
          className="px-4 py-2 text-xs font-body tracking-[0.05em] uppercase border border-rule rounded-[var(--r-input)] text-mid hover:border-forest hover:text-forest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {checking ? 'Checking...' : 'Check'}
        </button>
      </div>
      {result && (
        <p className="mt-2 font-body text-xs text-mid">
          {result.serviceable ? (
            <>
              Delivers to <span className="text-text">{result.state}</span>
              {result.minDays != null || result.maxDays != null ? (
                <> in {result.minDays ?? result.maxDays}–{result.maxDays ?? result.minDays} days</>
              ) : null}
              {' — '}
              {result.cost === 0 ? 'free shipping' : `shipping ${formatPrice(result.cost)}`}
            </>
          ) : (
            <span className="text-clay">{result.error}</span>
          )}
        </p>
      )}
    </div>
  )
}

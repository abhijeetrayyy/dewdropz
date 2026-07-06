'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export default function SizeGuideModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button 
        type="button"
        onClick={() => setOpen(true)}
        className="font-body text-[10px] tracking-widest uppercase text-mid hover:text-forest transition-colors ml-auto underline underline-offset-4"
      >
        Size Guide
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-paper p-8 shadow-2xl z-50 border border-rule"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-2xl text-text">Sizing Reference</h3>
                <button onClick={() => setOpen(false)} className="text-mid hover:text-forest transition-colors text-xl leading-none">
                  &times;
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-body text-sm">
                  <thead>
                    <tr className="border-b border-rule">
                      <th className="py-3 font-normal text-mid uppercase text-xs tracking-widest">Size</th>
                      <th className="py-3 font-normal text-mid uppercase text-xs tracking-widest">Chest (in)</th>
                      <th className="py-3 font-normal text-mid uppercase text-xs tracking-widest">Length (in)</th>
                      <th className="py-3 font-normal text-mid uppercase text-xs tracking-widest">Sleeve (in)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['S', 'M', 'L', 'XL', 'XXL'].map((sz, i) => (
                      <tr key={sz} className="border-b border-rule/50">
                        <td className="py-4 font-bold text-text">{sz}</td>
                        <td className="py-4 text-text">{38 + (i * 2)}</td>
                        <td className="py-4 text-text">{27 + (i * 1)}</td>
                        <td className="py-4 text-text">{8 + (i * 0.5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="font-body text-xs text-mid mt-6">
                Measurements are garment dimensions. For an oversized fit, we recommend sizing up.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

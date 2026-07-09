'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#fff',
          color: '#000',
          border: '1px solid #e5e7eb',
          fontSize: '14px',
        },
      }}
    />
  )
}

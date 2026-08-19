'use client'

import { Toaster } from 'sonner'

/**
 * The storefront's toast surface.
 *
 * `sonner` has been a dependency of this project for its whole life and is
 * imported in 39 files. `<Toaster />` was mounted in exactly two places —
 * `app/admin/AdminLayoutClient.tsx` and `app/trek-buddy/layout.tsx` — and
 * never in the root layout. So the shop owner was told when a tag was renamed,
 * and the customer spending four thousand rupees was told nothing at all when
 * their cart changed. Every `toast.*` call fired from a storefront component
 * rendered into a void.
 *
 * The admin toaster is hardcoded white with a grey border, which is right for
 * an operations tool and wrong on paper stock that runs from #F8F5ED to near
 * black across one scroll. This one is set in the storefront's own tokens so
 * it lands on any section of the page as part of it.
 */
export default function ShopToaster() {
  return (
    <Toaster
      position="bottom-center"
      offset={20}
      duration={4200}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-sm !border !border-forest/15 !bg-paper !text-text !shadow-[var(--shadow-panel)] !font-body',
          title: '!font-body !text-[14px] !font-medium !text-text',
          description: '!font-body !text-[13px] !text-mid !mt-0.5',
          actionButton:
            '!bg-forest !text-paper !rounded-full !px-4 !h-8 !font-body !text-[11px] !uppercase !tracking-[0.14em]',
          icon: '!text-forest',
        },
      }}
    />
  )
}

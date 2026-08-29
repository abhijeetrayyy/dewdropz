'use client'

import Script from 'next/script'
import { useConsent } from '@/providers/ConsentProvider'

/**
 * Trackers, and the conditions under which they are allowed to exist.
 *
 * WHAT WAS WRONG. Both IDs fell back to placeholders — `G-XXXXXXXXXX` and
 * `XXXXXXXXXXXXX` — and the scripts loaded unconditionally. So every visitor to
 * this shop fetched Google Tag Manager and Facebook's `fbevents.js`, handed
 * Meta a pageview keyed to a pixel id that does not exist, and set third-party
 * cookies. That collected nothing useful and cost something real: a request to
 * two ad networks on every page load, and personal data leaving the site with
 * no basis for it under the DPDP Act or GDPR.
 *
 * A placeholder is not a configuration. If an id is absent or still the
 * placeholder, nothing loads at all — the correct behaviour for a shop that is
 * not yet measuring anything.
 *
 * TWO CONDITIONS, BOTH REQUIRED. A real id AND an explicit yes from this
 * visitor. Configuration alone is not permission: with keys set and no consent
 * gate, this would drop third-party cookies on first paint for everybody, which
 * is the thing the DPDP Act and the GDPR are actually about. See
 * `providers/ConsentProvider.tsx`.
 */

const PLACEHOLDERS = new Set(['G-XXXXXXXXXX', 'XXXXXXXXXXXXX', ''])

function configured(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !PLACEHOLDERS.has(value)
}

const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent()
  const allowed = consent === 'granted'

  const ga = allowed && configured(GA_TRACKING_ID) ? GA_TRACKING_ID : null
  const pixel = allowed && configured(META_PIXEL_ID) ? META_PIXEL_ID : null

  return (
    <>
      {ga && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga}', {
              page_path: window.location.pathname,
            });
          `,
            }}
          />
        </>
      )}

      {pixel && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixel}');
            fbq('track', 'PageView');
          `,
          }}
        />
      )}
      {children}
    </>
  )
}

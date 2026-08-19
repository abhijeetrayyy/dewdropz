import { ImageResponse } from 'next/og'

/**
 * The share card.
 *
 * There was no OG image anywhere in `app/`, and no `openGraph` block either, so
 * every share of this domain — on WhatsApp, overwhelmingly, for a brand like
 * this — rendered as a grey rectangle captioned "Premium Indian outdoor
 * trekking and adventure gear", a description for a shop this is not.
 *
 * Generated rather than a static file so it cannot drift from the brand and
 * costs nothing to keep current. Drawn in the storefront's own palette; the
 * type falls back to the runtime's default sans, because loading Fraunces into
 * the edge renderer means shipping a font binary for one image and the card
 * reads perfectly well without it.
 */

export const alt =
  'DEWDROPZ — mountain-inspired apparel and drinkware, printed to order in Dehradun'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#101E17',
          padding: '72px 80px',
          position: 'relative',
        }}
      >
        {/* Dawn, arriving at an edge — the brand's one accent, used once. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              'linear-gradient(90deg, #101E17 0%, #E39B3F 38%, #F6DCA8 55%, #E39B3F 72%, #101E17 100%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            fontSize: 26,
            letterSpacing: 12,
            color: '#F8F5ED',
            fontWeight: 700,
            display: 'flex',
          }}
        >
          DEWDROPZ
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.02,
              color: '#F8F5ED',
              letterSpacing: -2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Go where</span>
            <span style={{ color: '#7BA46F', fontStyle: 'italic' }}>you feel alive.</span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              color: 'rgba(248,245,237,0.72)',
              maxWidth: 820,
              lineHeight: 1.35,
              display: 'flex',
            }}
          >
            Heavyweight blanks and drinkware, printed one at a time in Dehradun.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 36,
            fontSize: 21,
            letterSpacing: 2,
            color: 'rgba(248,245,237,0.62)',
            borderTop: '1px solid rgba(248,245,237,0.16)',
            paddingTop: 24,
          }}
        >
          <span>CASH ON DELIVERY</span>
          <span>·</span>
          <span>FREE OVER ₹2,000</span>
          <span>·</span>
          <span>7-DAY RETURNS</span>
        </div>
      </div>
    ),
    size
  )
}

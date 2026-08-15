import { HomepageEngine } from './HomepageEngine'

// The storefront's front page is merchandising, not configuration — it belongs
// next to products and collections rather than buried in Settings.
export default function HomepagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Homepage</h2>
        <p className="text-sm text-gray-500 mt-1">
          What the storefront shows on its front page — featured collections, showcases and copy.
        </p>
      </div>
      <HomepageEngine />
    </div>
  )
}

import { DesignLibraryEngine } from './DesignLibraryEngine'

// The pre-set artwork the customisation studio offers alongside "upload your
// own". Catalogue, not configuration — it sits with Products and Collections
// because adding a design is merchandising work, done weekly, by the same
// person who lists a garment.
export default function DesignLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Design Library</h2>
        <p className="text-sm text-gray-500 mt-1">
          Ready-made DEWDROPZ artwork, offered in the studio beside the customer&apos;s own
          uploads. PNGs with a transparent background work on every garment colour.
        </p>
      </div>
      <DesignLibraryEngine />
    </div>
  )
}

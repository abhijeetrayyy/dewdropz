import { getAttributes } from '@/actions/attributes'
import AttributesClient from './AttributesClient'
import type { AttributeWithValues } from '@/types/database'

// See the note in tags/page.tsx — same shape, same reason.
export default async function AttributesPage() {
  const attrs = (await getAttributes()) as AttributeWithValues[]
  return <AttributesClient initial={attrs} />
}

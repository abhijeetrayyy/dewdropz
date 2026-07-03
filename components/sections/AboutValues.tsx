import ValuesGrid from '@/components/ValuesGrid'
import { PHILOSOPHY_VALUES } from '@/lib/constants'

export default function AboutValues() {
  return <ValuesGrid eyebrow="What We Believe" title="Four things we won't compromise on." values={PHILOSOPHY_VALUES} />
}

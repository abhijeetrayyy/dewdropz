import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import JournalArticle from '@/components/sections/JournalArticle'
import { JOURNAL } from '@/lib/constants'

export function generateStaticParams() {
  return JOURNAL.map((entry) => ({ slug: entry.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const entry = JOURNAL.find((e) => e.id === slug)
  if (!entry) return {}
  return {
    title: `${entry.title} — DEWDROPZ Journal`,
    description: entry.excerpt,
  }
}

export default async function JournalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = JOURNAL.find((e) => e.id === slug)
  if (!entry) notFound()

  const related = JOURNAL.filter((e) => e.id !== entry.id).slice(0, 2)

  return (
    <>
      <NavBar />
      <main>
        <JournalArticle entry={entry} related={related} />
      </main>
      <FooterSection />
    </>
  )
}

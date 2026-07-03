import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import ContactForm from '@/components/sections/ContactForm'
import ContactFAQ from '@/components/sections/ContactFAQ'

export const metadata: Metadata = {
  title: 'Contact — DEWDROPZ',
  description: 'Reach the DEWDROPZ team in Dehradun — questions, wholesale, or trail advice.',
}

export default function ContactPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Contact"
          title="Say hello."
          subtitle="Whether it's a sizing question, a wholesale inquiry, or you just want trail advice — we're a small team and we actually answer."
        />
        <ContactForm />
        <ContactFAQ />
      </main>
      <FooterSection />
    </>
  )
}

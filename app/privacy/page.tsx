import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import { SITE } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Privacy Policy — DEWDROPZ',
  description: 'How DEWDROPZ collects, uses, and protects your information.',
}

const SECTIONS = [
  {
    title: 'Information We Collect',
    body: 'When you create an account, place an order, or subscribe to our newsletter, we collect your name, email, phone number, and shipping address. Payment details are handled directly by our payment processors and never stored on our servers.',
  },
  {
    title: 'How We Use It',
    body: 'We use your information to process orders, provide customer support, send shipping updates, and — only if you\'ve opted in — share occasional trail stories and product updates. We do not sell your data to third parties.',
  },
  {
    title: 'Payments',
    body: 'Card and UPI payments are processed securely through Stripe and Razorpay. DEWDROPZ never sees or stores your full card number.',
  },
  {
    title: 'Cookies',
    body: 'We use essential cookies to keep your cart and session working, and lightweight analytics cookies to understand which trails — and pages — people care about most. You can disable non-essential cookies in your browser at any time.',
  },
  {
    title: 'Data Retention',
    body: 'We retain order history for as long as your account is active, and as required by Indian tax law thereafter. You can request full account and data deletion at any time.',
  },
  {
    title: 'Your Rights',
    body: 'You can request access to, correction of, or deletion of your personal data at any time by contacting us. We respond to all requests within 30 days.',
  },
]

export default function PrivacyPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Legal"
          title="Privacy Policy"
          subtitle="Last updated April 2026. Plain language, no legalese we wouldn't say to your face."
        />

        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-2xl mx-auto flex flex-col gap-10">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="font-display text-xl text-text mb-3">{section.title}</h2>
                <p className="font-body text-sm text-mid leading-relaxed">{section.body}</p>
              </div>
            ))}

            <div className="border-t border-rule pt-8">
              <p className="font-body text-sm text-mid leading-relaxed">
                Questions about this policy? Reach us at{' '}
                <a href={`mailto:${SITE.email}`} className="text-forest hover:underline">
                  {SITE.email}
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}

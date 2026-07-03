'use client'

import Accordion from '@/components/Accordion'
import { CONTACT_FAQS } from '@/lib/constants'

export default function ContactFAQ() {
  return (
    <section className="bg-paper px-6 md:px-10 py-20 md:py-28">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="font-body text-[10px] tracking-[0.2em] text-forest uppercase">Before You Ask</div>
          <h2 className="mt-4 font-display font-light text-[clamp(28px,4vw,38px)] text-text leading-[1.1]">
            Common questions.
          </h2>
        </div>

        <div>
          {CONTACT_FAQS.map((faq, i) => (
            <Accordion
              key={faq.question}
              title={faq.question}
              content={faq.answer}
              defaultOpen={i === 0}
              titleSize="question"
            />
          ))}
        </div>
      </div>
    </section>
  )
}

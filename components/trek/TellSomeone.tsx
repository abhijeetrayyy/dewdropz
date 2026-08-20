'use client'

import { useState } from 'react'

// The one safety instruction this board repeats, turned into a button.
//
// "Tell someone who is not coming" is the first of the six take-care notes, it
// is clause three of the deal every member accepts at sign-up, and it is the
// single most useful thing a person can do before meeting strangers outdoors —
// the notes say so themselves: "It is the single most useful thing you can do,
// and it costs one message."
//
// It cost one message and the product never composed it. Four separate screens
// told the member that nobody is watching a screen while they are out, and then
// handed them nothing. The advice was everywhere and the tool was nowhere.
//
// Everything in the message is already on this page. Nothing is invented, and
// nothing is sent by the platform: this opens the member's own WhatsApp or SMS
// with the text prefilled, and they choose who gets it and whether to press
// send. DEWDROPZ transmits nothing and stores nothing about it.
//
// THE EXACT MEETING POINT IS DELIBERATELY NOT IN IT, even for a confirmed
// walker who can see it. The whole board is built so that address reaches
// confirmed walkers and stops there; piping it into a third-party messenger
// addressed to somebody who is not on the walk would undo that in one tap, and
// it would do it under a safety label. The message carries `meet_area` — the
// town or landmark that is on the public card anyway — which is what somebody
// at home actually needs to know where to start asking.

export default function TellSomeone({
  place,
  meetArea,
  startsAt,
  startTime,
  backBy,
  hostName,
}: {
  place: string
  /** The public area, never the exact meeting point. */
  meetArea: string
  startsAt: string
  startTime: string | null
  backBy: string | null
  hostName: string
}) {
  const [copied, setCopied] = useState(false)

  const day = new Date(startsAt).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const message = [
    `I'm going walking on ${day}.`,
    `Where: ${place}, setting off from ${meetArea}.`,
    startTime ? `Leaving: ${startTime.slice(0, 5)}.` : null,
    backBy ? `Back by: ${backBy.slice(0, 5)}.` : null,
    `It's a group walk organised between members on DEWDROPZ TrekBuddy — ${hostName} is hosting.`,
    `If you haven't heard from me well after that, start asking.`,
  ]
    .filter(Boolean)
    .join('\n')

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`
  const sms = `sms:?&body=${encodeURIComponent(message)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-[var(--r-card)] border border-forest/20 bg-sage-soft/50 p-5">
      <p className="trek-label text-forest">Before you go</p>
      <h3 className="trek-h3 mt-2 text-text">Tell someone who is not coming.</h3>
      <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
        The place, the hour and when you expect to be back. It is the most useful thing you can do
        and it costs one message — so here it is, written out. Nobody from DEWDROPZ sends or sees
        it, and the exact meeting point is left out on purpose.
      </p>

      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-3 font-body text-[13px] leading-relaxed text-text">
        {message}
      </pre>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="trek-pill trek-pill-sm trek-pill-act font-body"
        >
          Send on WhatsApp
        </a>
        <a href={sms} className="trek-pill trek-pill-sm trek-pill-quiet font-body">
          Send as a text
        </a>
        <button
          type="button"
          onClick={copy}
          className="border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:border-text hover:text-text"
        >
          {copied ? 'Copied' : 'Copy it'}
        </button>
      </div>
    </div>
  )
}

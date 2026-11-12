import React from 'react';
import { Marquee, InView } from '@/components/motion';
import { Accordion, type AccordionItem, Badge } from '@/components/ui';
import { Quote, HelpCircle, Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Rajeshwar Reddy',
    role: 'VP Sales · UrbanNest Realty, Hyderabad',
    language: 'Telugu & English',
    quote:
      'Our 99acres and Meta leads now get a warm Telugu call in 18 seconds flat. Weekend site-visit bookings jumped 3.1× without adding a single telecaller.',
  },
  {
    name: 'Dr. Meenakshi Iyer',
    role: 'Director · MedCare Clinics, Chennai',
    language: 'Tamil & English',
    quote:
      'Missed OPD calls dropped to zero. Patients confirm or reschedule appointments naturally in Tamil, and our front desk only handles walk-ins.',
  },
  {
    name: 'Ankur Malhotra',
    role: 'Head of Admissions · ApexPrep EdTech, Noida',
    language: 'Hindi & Hinglish',
    quote:
      'We dialed 12,000 dormant NEET enquiries in 48 hours with full TRAI 10 AM–6 PM compliance. Cost per qualified counseling session fell by 68%.',
  },
  {
    name: 'Sandeep Kulkarni',
    role: 'GM Operations · Horizon Motors, Bengaluru',
    language: 'Kannada & English',
    quote:
      'Service reminder calls in Kannada feel completely natural. Customers don’t hang up — they actually ask about pickup slots and get WhatsApp confirmations.',
  },
  {
    name: 'Priyanka Deshmukh',
    role: 'Founder · FinEdge Advisory, Pune',
    language: 'Marathi & Hindi',
    quote:
      'Integer paise billing with ₹0 charge on unanswered rings makes unit economics crystal clear. Every rupee is accounted for with 18% GST invoices.',
  },
  {
    name: 'Nikhil Menon',
    role: 'COO · SwiftShip Logistics, Kochi',
    language: 'Malayalam & English',
    quote:
      'COD order verification in Malayalam cut our RTO losses by 24% in the first month. Setup took less than 15 minutes with our existing Exotel trunk.',
  },
];

const FAQ_ITEMS: AccordionItem[] = [
  {
    id: 'trai-dnd',
    category: 'Compliance',
    question: 'How does Trivaana enforce TRAI TCCCPR & NDNC compliance?',
    answer:
      'Trivaana automatically blocks promotional outbound calls outside the permitted 10:00 AM – 6:00 PM IST window, scrubs numbers against your workspace DNC/NDNC lists before dialing, and supports DLT entity/template registration.',
  },
  {
    id: 'languages',
    category: 'Voices',
    question: 'Which Indian languages and accents are supported?',
    answer:
      'All 7 major regional languages are supported out of the box: Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, and Indian English — powered by Sarvam AI (Bulbul v3) and ElevenLabs Flash v2.5, including natural code-mixed phrasing like Hinglish and Tenglish.',
  },
  {
    id: 'billing',
    category: 'Pricing',
    question: 'Do I pay for unanswered, busy, or failed call attempts?',
    answer:
      'No. Unanswered calls, busy signals, and failed rings cost ₹0. You are only metered for connected talk time in deterministic integer paise (₹6.50/min Standard or ₹8.50/min Premium), with instant Razorpay UPI top-ups and 18% GST tax invoices.',
  },
  {
    id: 'telephony',
    category: 'Telephony',
    question: 'Can I bring my own Exotel, Plivo, Vobiz, or Twilio number?',
    answer:
      'Yes. You can connect your existing Exotel, Plivo, Vobiz, or Twilio SIP/DID numbers in Settings → Integrations, or provision new virtual numbers directly inside the Numbers & Channels panel.',
  },
  {
    id: 'crm',
    category: 'Integrations',
    question: 'How do leads enter Trivaana and sync back to our CRM?',
    answer:
      'Leads can arrive via Meta Lead Ads, Google Forms, IndiaMART, CSV upload, or our public REST intake webhook (POST /api/public/lead-intake/{slug}). After every call, transcripts, recordings, and extracted JSON fields sync back via outbound webhooks.',
  },
  {
    id: 'security',
    category: 'Security',
    question: 'Is customer data isolated per workspace?',
    answer:
      'Yes. Every database entity (agents, leads, campaigns, call logs, transcripts, and wallet transactions) is strictly scoped by tenant_id with server-verified authentication and HMAC-SHA256 webhook signatures.',
  },
];

export const TestimonialsAndFaqSection: React.FC = () => {
  return (
    <>
      {/* Testimonials Marquee Section */}
      <section className="py-20 bg-white border-b border-[#e4e4e9] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <InView className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <Badge variant="primary" className="mb-3">
                <Star className="w-3 h-3 fill-[#ff5500] text-[#ff5500]" />
                <span>Customer Stories</span>
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight">
                Trusted by high-velocity Indian teams
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#525260] max-w-md">
              Real estate developers, clinics, edtech counselors, and B2B operations running thousands of daily vernacular calls.
            </p>
          </InView>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-white to-transparent z-10" />
          <Marquee pauseOnHover className="[--duration:42s]">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="w-[320px] sm:w-[360px] shrink-0 rounded-2xl bg-[#fcfcfd] border border-[#e4e4e9] p-5 flex flex-col justify-between gap-4 shadow-2xs hover:border-[#d4d4dc] transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Quote className="w-4 h-4 text-[#ff5500]" />
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
                      {t.language}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#0f0f14] leading-relaxed font-medium">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="pt-3 border-t border-[#e4e4e9]/80">
                  <div className="text-xs font-bold text-[#0f0f14]">{t.name}</div>
                  <div className="text-[11px] text-[#525260]">{t.role}</div>
                </div>
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* Accessible FAQ Accordion Section */}
      <section id="faq" className="py-20 bg-[#fcfcfd] border-b border-[#e4e4e9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <InView className="text-center mb-12">
            <Badge variant="outline" className="mb-3">
              <HelpCircle className="w-3 h-3 text-[#ff5500]" />
              <span>Frequently Asked Questions</span>
            </Badge>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0f0f14] tracking-tight">
              Clear answers before you launch
            </h2>
            <p className="mt-3 text-sm text-[#525260]">
              Everything about Indian language support, TRAI compliance, telephony trunks, and transparent per-minute billing.
            </p>
          </InView>

          <Accordion items={FAQ_ITEMS} defaultOpenId="trai-dnd" />
        </div>
      </section>
    </>
  );
};


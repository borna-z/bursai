import { useLanguage } from '@/contexts/LanguageContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Helmet } from 'react-helmet-async';

const FAQ_KEYS = [
  { q: 'landing.faq1_q', a: 'landing.faq1_a' },
  { q: 'landing.faq2_q', a: 'landing.faq2_a' },
  { q: 'landing.faq3_q', a: 'landing.faq3_a' },
  { q: 'landing.faq4_q', a: 'landing.faq4_a' },
  { q: 'landing.faq5_q', a: 'landing.faq5_a' },
  { q: 'landing.faq6_q', a: 'landing.faq6_a' },
];

export function FAQSection() {
  const { t } = useLanguage();

  const faqItems = FAQ_KEYS.map(f => ({
    question: t(f.q),
    answer: t(f.a),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      <section id="faq" className="px-6 py-20 md:py-28 relative" style={{ zIndex: 14 }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
            FAQ
          </p>
          <h2 className="text-2xl md:text-4xl font-bold text-center tracking-tight text-white font-space mb-12 reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
            {t('landing.faq_title')}
          </h2>

          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="glass-panel rounded-xl border-white/5 px-6 reveal-up"
                style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}
              >
                <AccordionTrigger className="text-sm text-white hover:no-underline py-5">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-400 pb-5 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}

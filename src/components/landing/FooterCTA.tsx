import { useNavigate } from "react-router-dom";
import { ArrowRight, Instagram } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Helmet } from "react-helmet-async";
import bursFooterLogo from "@/assets/burs-monogram.png";

const FAQ_KEYS = [
  { q: "landing.faq1_q", a: "landing.faq1_a" },
  { q: "landing.faq2_q", a: "landing.faq2_a" },
  { q: "landing.faq3_q", a: "landing.faq3_a" },
  { q: "landing.faq4_q", a: "landing.faq4_a" },
  { q: "landing.faq5_q", a: "landing.faq5_a" },
  { q: "landing.faq6_q", a: "landing.faq6_a" },
];

export function FooterCTA() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const faqItems = FAQ_KEYS.map((f) => ({
    question: t(f.q),
    answer: t(f.a),
  }));

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <section className="px-6 pt-20 md:pt-32 pb-12">
        <div className="max-w-3xl mx-auto">
          {/* CTA */}
          <div className="text-center mb-20 reveal-up">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-space mb-5">
              {t("landing.cta_title")}
            </h2>
            <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">{t("landing.cta_desc")}</p>
            <button
              onClick={() => navigate("/auth")}
              className="group px-10 py-4 bg-white text-[#030305] rounded-full font-semibold tracking-wide hover:scale-[1.03] transition-transform duration-300 inline-flex items-center gap-2.5 text-sm"
            >
              {t("landing.get_started")}
              <ArrowRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* FAQ */}
          <div className="mb-20">
            <h3 className="text-lg font-semibold text-white font-space text-center mb-8 reveal-up">
              {t("landing.faq_title")}
            </h3>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-xl border border-white/[0.06] px-5 reveal-up"
                  style={{ "--reveal-delay": `${i * 60}ms` } as React.CSSProperties}
                >
                  <AccordionTrigger className="text-sm text-white hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-gray-400 pb-4 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Footer */}
          <footer className="border-t border-white/[0.04] pt-8 pb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
              <img src={bursLandingLogo} alt="BURS" className="h-5 object-contain" />
              <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500 tracking-wide">
                <a href="/privacy" className="hover:text-white transition-colors">
                  {t("footer.privacy")}
                </a>
                <a href="/terms" className="hover:text-white transition-colors">
                  {t("footer.terms")}
                </a>
                <a href="/contact" className="hover:text-white transition-colors">
                  {t("landing.footer_contact")}
                </a>
              </div>
              <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <a
                  href="https://www.instagram.com/burs_style"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="hover:text-white text-gray-500 transition-colors"
                >
                  <Instagram size={16} strokeWidth={1.5} />
                </a>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] text-gray-600">
              <p>
                {t("footer.agree")}{" "}
                <a href="/privacy" className="underline hover:text-white transition-colors">
                  {t("footer.privacy")}
                </a>
                .
              </p>
              <span className="text-gray-500">© {new Date().getFullYear()} BURS AB</span>
              <span>{t("landing.footer_gdpr")}</span>
            </div>
            <div className="text-center mt-4 text-[10px] text-gray-600">
              Powered by AI · BURS uses{" "}
              <a
                href="https://ai.google.dev"
                target="_blank"
                rel="noopener"
                className="underline hover:text-white transition-colors"
              >
                Google Gemini
              </a>{" "}
              for intelligent styling recommendations
            </div>
            ```
          </footer>
        </div>
      </section>
    </>
  );
}

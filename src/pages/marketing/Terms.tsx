import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BursMonogram } from '@/components/ui/BursMonogram';

const sections = [
  {
    title: '2.1 Acceptance of Terms',
    content:
      'By creating an account with BURS, you agree to these Terms. If you do not agree, please do not use the service.',
  },
  {
    title: '2.2 Use of the Service',
    content: `Eligibility: You must be at least 13 years old.

User Content: You retain all ownership rights to the photos you upload. You grant BURS a limited, non-exclusive license to process and display these photos solely for the purpose of providing the styling service to you.

Prohibited Content: You may not upload images that are illegal, pornographic, or infringe on the intellectual property of others.`,
  },
  {
    title: '2.3 Subscription and Payments',
    content: `Premium Tier: Fees for BURS Premium (79 kr/month or 699 kr/year) are billed in advance.

Right of Withdrawal (EU): If you are a consumer in the EU, you have the right to cancel your subscription within 14 days of purchase, provided you have not begun using the Premium styling features.

Cancellations: You may cancel at any time. Your access will remain active until the end of the current billing cycle.`,
  },
  {
    title: '2.4 Disclaimers',
    content: `"As-Is" Basis: BURS is provided "as-is." While our AI tries to be accurate, we do not guarantee that outfit suggestions will be appropriate for specific weather conditions or formal dress codes.

No Liability: BURS AB is not liable for any damages resulting from the use of the app, including but not limited to clothing damage (from following care suggestions) or missed events due to styling errors.`,
  },
  {
    title: '2.5 Governing Law',
    content:
      'These terms are governed by the laws of Sweden. Any disputes shall be resolved in the courts of Stockholm, Sweden.',
  },
];

export default function Terms() {
  const { t } = useLanguage();

  return (
    <div className="force-light">
      <Helmet>
        <title>Terms of Service | BURS</title>
        <meta name="description" content="Terms of Service for BURS — acceptance, subscriptions, disclaimers, and governing law." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Header */}
        <header className="w-full border-b border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/welcome" className="flex items-center gap-2">
              <BursMonogram size={28} />
              <span className="font-bold tracking-[0.12em] text-sm" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
            </Link>
            <Link to="/welcome" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-3xl mx-auto px-4 py-12 md:py-20 w-full">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service for BURS</h1>
          <p className="text-muted-foreground mb-12">Effective Date: February 22, 2026</p>

          <div className="space-y-8">
            {sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
              </section>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground font-medium text-foreground">Terms of Service</Link>
              <Link to="/contact" className="hover:text-foreground">{t('landing.footer_contact')}</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

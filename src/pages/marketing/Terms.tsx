import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import bursLogo from '@/assets/burs-landing-logo.png';

const TERMS = {
  title: 'Terms of Service',
  lastUpdated: '2025-02-19',
  sections: [
    { title: 'Acceptance', content: 'By using BURS you accept these terms. If you do not accept, please do not use the service.' },
    { title: 'The Service', content: 'BURS is a digital wardrobe manager and personal AI stylist that helps you organize garments, create outfits, and plan your wardrobe. The service is provided "as is" without warranties.' },
    { title: 'Your Content', content: 'You retain ownership of images and content you upload. You grant us the right to use this to provide the service to you.' },
    { title: 'Body measurements and personal data', content: "Body measurements (height and weight) are optional and used exclusively to improve the AI stylist's advice. This data is stored encrypted and deleted upon your request." },
    { title: 'Limitations', content: 'We are not liable for any damages arising from use of the service. Maximum liability is limited to fees you have paid in the last 12 months.' },
    { title: 'Changes', content: 'We may update these terms. Material changes will be communicated via email or in the app.' },
  ],
};

export default function Terms() {
  const { t } = useLanguage();
  return (
    <div className="force-light">
      <Helmet>
        <title>{TERMS.title} | BURS</title>
        <meta name="description" content="Terms of Service for BURS." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Header */}
        <header className="w-full border-b border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/welcome" className="flex items-center gap-2">
              <img src={bursLogo} alt="BURS" className="h-7 w-7 rounded-lg" />
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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{TERMS.title}</h1>
          <p className="text-muted-foreground mb-12">{t('common.last_updated')} {TERMS.lastUpdated}</p>

          <div className="space-y-8">
            {TERMS.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              </section>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground font-medium text-foreground">Terms</Link>
              <Link to="/contact" className="hover:text-foreground">Contact</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
            <p className="text-center max-w-md">BURS complies with GDPR. Your data is stored securely and never shared with third parties.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

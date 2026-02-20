import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import bursLogo from '@/assets/burs-landing-logo.png';

const PRIVACY = {
  title: 'Privacy Policy',
  lastUpdated: '2025-02-19',
  contactEmail: 'privacy@burs.se',
  sections: [
    { title: 'Data we collect', content: 'We collect information you provide directly, such as your email address at registration, images of garments you upload, conversations with the AI stylist, and optional body measurements (height and weight). We also collect technical data such as device type and usage patterns to improve the service.' },
    { title: 'Storage', content: 'All data is stored securely in the cloud with strong encryption. Images of garments, body, and conversation history are stored privately and only accessible to your account. Body measurements are stored encrypted and never shared.' },
    { title: 'Calendar data', content: 'If you choose to connect your calendar via ICS link, the app reads event titles and dates to provide smart outfit suggestions. Calendar data is stored locally and not synchronized with third parties.' },
    { title: 'AI Stylist', content: 'Conversations with the AI stylist are saved encrypted so the stylist can remember your preferences. The content of conversations is not shared with third parties and is not used for AI model training.' },
    { title: 'Analytics', content: 'We use anonymous analytics to understand how the service is used and improve the experience. No personal data is shared with third parties for marketing.' },
    { title: 'Deletion', content: 'You can delete your account and all associated data at any time – including images, garments, chats, and body measurements – from the settings in the app. Deletion is permanent and irreversible.' },
  ],
};

export default function PrivacyPolicy() {
  const { t } = useLanguage();
  return (
    <div className="force-light">
      <Helmet>
        <title>{PRIVACY.title} | BURS</title>
        <meta name="description" content="Privacy Policy for BURS. Learn how we handle your data." />
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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{PRIVACY.title}</h1>
          <p className="text-muted-foreground mb-12">{t('common.last_updated')} {PRIVACY.lastUpdated}</p>

          <div className="space-y-8">
            {PRIVACY.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              </section>
            ))}

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about privacy, contact us at{' '}
                <a href={`mailto:${PRIVACY.contactEmail}`} className="text-accent hover:underline">
                  {PRIVACY.contactEmail}
                </a>
              </p>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground font-medium text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground">Terms</Link>
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

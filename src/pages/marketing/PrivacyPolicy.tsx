import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BursMonogram } from '@/components/ui/BursMonogram';

const sections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content:
      'BURS AB ("we," "our," or "us") provides an AI-driven wardrobe and styling application. This Privacy Policy explains how we collect, use, and protect your information, including data from third-party services like Google Calendar.',
  },
  {
    id: 'google-user-data',
    title: '2. Google User Data (Calendar Integration)',
    content: `To provide a personalized styling experience based on your schedule, BURS allows you to optionally connect your Google Calendar.

Data We Access: When you authorize BURS, we request read-only access to your calendar events. We access the following fields only: Event title/summary, Start/End date and time, Time zone, and Location.

What We Do NOT Access: We do not access your emails, contacts, Google Drive files, or any other Google services.

How We Use This Data: We use timing and location information to:
• Generate outfit suggestions (e.g., suggesting professional attire for a meeting).
• Create weekly outfit planning synced to your specific events.

No Commercial Sharing: We do not sell Google user data, share it with advertisers, use it for ad targeting, or build advertising profiles.`,
  },
  {
    id: 'ai-processing',
    title: '3. AI Processing & Wardrobe Data',
    content: `Image Data: We process photos of your garments to tag color, material, and style.

Privacy-First AI: Your wardrobe data is processed securely. We do not use your personal photos to train public AI models without your explicit, separate consent.

Derived Data: Our "neural styling engine" creates outfit combinations based on the intersection of your wardrobe, your Google Calendar events, and local weather data.`,
  },
  {
    id: 'storage-retention',
    title: '4. Storage & Retention',
    content: `Encryption: All data, including OAuth access/refresh tokens for Google, is encrypted at rest and transmitted via TLS encryption.

Google Tokens: Tokens are stored securely in our backend and are retained only until you disconnect the integration or delete your BURS account.

Temporary Processing: Raw calendar event data is processed temporarily to generate suggestions; we do not store raw event logs permanently. Only the resulting "Outfit Plan" is stored.

Wardrobe Data: Images and tags are stored until you delete the item or your account.`,
  },
  {
    id: 'sharing-disclosure',
    title: '5. Sharing & Disclosure',
    content: `We do not share your personal data or Google Calendar data with third parties.

Automated Processing: Data is processed automatically. No human reviews your calendar content unless you explicitly request a support intervention.

Compliance: We may disclose data only if required by Swedish law or a valid legal order.`,
  },
  {
    id: 'user-controls',
    title: '6. User Controls & Rights',
    content: `Disconnecting Services: You can revoke Google Calendar access at any time via Settings → Integrations or through your Google Account security settings.

Data Deletion: You may delete your account under Settings → Account. Disconnecting or deleting your account immediately purges your stored OAuth tokens.

GDPR Rights: As a user, you have the right to access, rectify, or erase your data, and the right to data portability.`,
  },
  {
    id: 'security',
    title: '7. Security',
    content: `We implement the Principle of Least Privilege, requesting only the minimum permissions (scopes) necessary for the app to function. Our infrastructure includes:
• Encryption at rest and in transit.
• Regular security audits of our AI processing pipeline.`,
  },
  {
    id: 'contact',
    title: '8. Contact',
    content: '',
  },
];

const anchorLinks = sections.map((s) => ({ id: s.id, label: s.title.replace(/^\d+\.\s*/, '') }));

export default function PrivacyPolicy() {
  const { t } = useLanguage();

  return (
    <div className="force-light">
      <Helmet>
        <title>Privacy Policy | BURS</title>
        <meta name="description" content="Privacy Policy for BURS — how we collect, use, and protect your data including Google Calendar integration." />
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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">BURS Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Effective Date: February 22, 2026</p>

          {/* Anchor navigation */}
          <nav className="flex flex-wrap gap-2 mb-10" aria-label="Jump to section">
            {anchorLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2 className="text-xl font-semibold mb-3">{s.title}</h2>
                {s.id === 'contact' ? (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    For privacy-related inquiries, please contact:{'\n'}
                    Email:{' '}
                    <a href="mailto:hello@burs.me" className="text-accent hover:underline">
                      hello@burs.me
                    </a>
                    {'\n'}Company: BURS AB (Stockholm, Sweden)
                  </p>
                ) : (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{s.content}</p>
                )}
              </section>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground font-medium text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
              <Link to="/contact" className="hover:text-foreground">{t('landing.footer_contact')}</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

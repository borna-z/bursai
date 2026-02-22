import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BursMonogram } from '@/components/ui/BursMonogram';

/* ─── Google Calendar Privacy Policy content (English, legal compliance) ─── */
const googlePrivacySections = [
  {
    id: 'overview',
    title: 'Overview',
    content:
      'BURS is an AI wardrobe and styling application. Users may optionally connect their Google Calendar to plan outfits based on their schedule.',
  },
  {
    id: 'data-accessed',
    title: 'Google User Data We Access',
    content: `When you connect Google Calendar, BURS requests read-only access to your calendar events.

We may access the following fields only if available:
• Event title or summary
• Start date and time
• End date and time
• Time zone
• Location (if included)

We do NOT access:
• Emails
• Contacts
• Google Drive files
• Any other Google services`,
  },
  {
    id: 'data-usage',
    title: 'How We Use Google User Data',
    content: `We use Google Calendar event timing information to:
• Generate outfit suggestions
• Create weekly outfit planning
• Align wardrobe planning with your schedule

Google user data is used solely to provide the calendar sync feature inside BURS.

We do NOT:
• Sell Google user data
• Share Google user data with advertisers
• Use Google data for ad targeting
• Build advertising profiles`,
  },
  {
    id: 'storage-retention',
    title: 'Storage & Retention',
    content: `• OAuth access and refresh tokens are securely stored in our backend.
• Tokens are encrypted at rest.
• Calendar event data is processed temporarily to generate outfit suggestions.
• Raw calendar events are not permanently stored by default.
• Only derived planning output (such as outfit plans) may be stored.

Tokens are retained until:
• User disconnects Google Calendar
• User deletes their BURS account

Disconnecting immediately deletes stored tokens.`,
  },
  {
    id: 'sharing',
    title: 'Sharing',
    content:
      'We do not share Google Calendar data with third parties.\n\nCalendar data is processed automatically by our systems.\n\nNo human reviews calendar content unless explicitly required for a support case initiated by the user.',
  },
  {
    id: 'user-controls',
    title: 'User Controls',
    content: `Users can:
• Disconnect Google Calendar under Settings → Integrations
• Delete their account under Settings → Account
• Revoke access via their Google Account security settings`,
  },
  {
    id: 'security',
    title: 'Security',
    content: `We implement:
• TLS encryption in transit
• Encryption at rest
• Principle of least privilege (minimum scopes requested)`,
  },
  {
    id: 'contact',
    title: 'Contact',
    content: `For privacy-related inquiries contact:\nprivacy@burs.me\n\nCompany name: BURS`,
  },
];

const anchorLinks = googlePrivacySections.map((s) => ({
  id: s.id,
  label: s.title,
}));

export default function Terms() {
  const { t } = useLanguage();

  const sections = [
    { title: t('terms.s1_title'), content: t('terms.s1_content') },
    { title: t('terms.s2_title'), content: t('terms.s2_content') },
    { title: t('terms.s3_title'), content: t('terms.s3_content') },
    { title: t('terms.s4_title'), content: t('terms.s4_content') },
    { title: t('terms.s5_title'), content: t('terms.s5_content') },
    { title: t('terms.s6_title'), content: t('terms.s6_content') },
  ];

  return (
    <div className="force-light">
      <Helmet>
        <title>Privacy Policy & Terms | BURS</title>
        <meta name="description" content="Privacy Policy and Terms of Service for BURS — including Google Calendar integration data practices." />
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

          {/* ─── Google Calendar Privacy Section ─── */}
          <section className="mb-16">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy — Google Calendar Integration</h1>
            <p className="text-muted-foreground mb-6">Last updated: 2025-06-01</p>

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
              {googlePrivacySections.map((s) => (
                <div key={s.id} id={s.id}>
                  <h2 className="text-xl font-semibold mb-3">{s.title}</h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Existing Terms & Conditions ─── */}
          <section>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('terms.title')}</h1>
            <p className="text-muted-foreground mb-12">{t('common.last_updated')} 2025-02-19</p>

            <div className="space-y-8">
              {sections.map((section, i) => (
                <div key={i}>
                  <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/terms" className="hover:text-foreground font-medium text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
              <Link to="/contact" className="hover:text-foreground">{t('landing.footer_contact')}</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
            <p className="text-center max-w-md">{t('privacy.gdpr_note')}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

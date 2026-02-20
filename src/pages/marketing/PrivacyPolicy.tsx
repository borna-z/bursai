import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const PRIVACY = {
  title: 'Privacy Policy',
  lastUpdated: '2025-02-19',
  contactEmail: 'privacy@example.com',
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
    <>
      <Helmet>
        <title>{PRIVACY.title} | BURS</title>
        <meta name="description" content="Privacy Policy for BURS." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Link>

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
              <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
              <p className="text-muted-foreground leading-relaxed">
                För frågor om integritet, kontakta oss på{' '}
                <a href={`mailto:${PRIVACY.contactEmail}`} className="text-primary hover:underline">
                  {PRIVACY.contactEmail}
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BursMonogram } from '@/components/ui/BursMonogram';

export default function PrivacyPolicy() {
  const { t } = useLanguage();

  const sections = [
    { title: t('privacy.s1_title'), content: t('privacy.s1_content') },
    { title: t('privacy.s2_title'), content: t('privacy.s2_content') },
    { title: t('privacy.s3_title'), content: t('privacy.s3_content') },
    { title: t('privacy.s4_title'), content: t('privacy.s4_content') },
    { title: t('privacy.s5_title'), content: t('privacy.s5_content') },
    { title: t('privacy.s6_title'), content: t('privacy.s6_content') },
  ];

  return (
    <div className="force-light">
      <Helmet>
        <title>{t('privacy.title')} | BURS</title>
        <meta name="description" content={t('privacy.title')} />
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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('privacy.title')}</h1>
          <p className="text-muted-foreground mb-12">{t('common.last_updated')} 2025-02-19</p>

          <div className="space-y-8">
            {sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              </section>
            ))}

            <section>
              <h2 className="text-xl font-semibold mb-3">{t('privacy.contact_title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.contact_text')}{' '}
                <a href="mailto:privacy@burs.se" className="text-accent hover:underline">
                  privacy@burs.se
                </a>
              </p>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground font-medium text-foreground">{t('privacy.title')}</Link>
              <Link to="/terms" className="hover:text-foreground">{t('terms.title')}</Link>
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

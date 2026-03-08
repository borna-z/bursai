import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BursMonogram } from '@/components/ui/BursMonogram';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    // Simulate sending
    await new Promise(r => setTimeout(r, 1000));
    setStatus('success');
  };

  return (
    <div className="force-light">
      <Helmet>
        <title>{t('contact.title')} — BURS</title>
        <meta name="description" content={t('contact.subtitle')} />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border/60">
          <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-muted">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <BursMonogram size={24} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-xl mx-auto px-4 py-12 md:py-20 w-full">
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-7 h-7 text-accent" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">{t('contact.title')}</h1>
            <p className="text-muted-foreground">{t('contact.subtitle')}</p>
          </div>

          <div className="text-center mb-10">
            <a href="mailto:hello@burs.se" className="text-accent hover:underline font-medium">
              hello@burs.se
            </a>
          </div>

          {status === 'success' ? (
            <div className="flex items-center justify-center gap-3 p-6 bg-accent/10 text-accent rounded-xl animate-fade-in">
              <Check className="w-5 h-5" />
              <span className="font-medium">{t('contact.success')}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input type="text" placeholder={t('contact.name')} value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="h-12" required />
              <Input type="email" placeholder={t('contact.email')} value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="h-12" required />
              <Textarea placeholder={t('contact.message')} value={formData.message} onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))} rows={5} required />
              <Button type="submit" className="w-full h-12 font-semibold" disabled={status === 'loading'}>
                {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />{t('contact.send')}</>}
              </Button>
            </form>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground">{t('footer.privacy')}</Link>
              <Link to="/terms" className="hover:text-foreground">{t('footer.terms')}</Link>
              <Link to="/contact" className="hover:text-foreground font-medium text-foreground">{t('contact.title')}</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. {t('contact.rights')}</p>
            <p className="text-center max-w-md">{t('contact.gdpr_note')}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

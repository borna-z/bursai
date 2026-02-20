import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import bursLogo from '@/assets/burs-landing-logo.png';

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setStatus('success');
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="force-light">
      <Helmet>
        <title>Contact | BURS</title>
        <meta name="description" content="Get in touch with the BURS team." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Header */}
        <header className="w-full border-b border-border/60">
          <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/welcome" className="flex items-center gap-2">
              <img src={bursLogo} alt="BURS" className="h-7 w-7 rounded-lg" />
              <span className="font-bold tracking-[0.12em] text-sm" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
            </Link>
            <Link to="/welcome" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-xl mx-auto px-4 py-12 md:py-20 w-full">
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-7 h-7 text-accent" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Contact</h1>
            <p className="text-muted-foreground">Have questions? We're happy to help.</p>
          </div>

          <div className="text-center mb-10">
            <a href="mailto:hello@burs.se" className="text-accent hover:underline font-medium">
              hello@burs.se
            </a>
          </div>

          {status === 'success' ? (
            <div className="flex items-center justify-center gap-3 p-6 bg-accent/10 text-accent rounded-xl animate-fade-in">
              <Check className="w-5 h-5" />
              <span className="font-medium">Thank you for your message. We'll get back to you shortly.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input type="text" placeholder="Your name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="h-12" required />
              <Input type="email" placeholder="Your email address" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="h-12" required />
              <Textarea placeholder="Your message" value={formData.message} onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))} rows={5} required />
              <Button type="submit" className="w-full h-12 font-semibold" disabled={status === 'loading'}>
                {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send message</>}
              </Button>
            </form>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="max-w-xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-xs text-muted-foreground">
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground">Terms</Link>
              <Link to="/contact" className="hover:text-foreground font-medium text-foreground">Contact</Link>
            </div>
            <p>© {new Date().getFullYear()} BURS. All rights reserved.</p>
            <p className="text-center max-w-md">BURS complies with GDPR. Your data is stored securely and never shared with third parties.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

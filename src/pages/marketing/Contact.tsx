import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
    <>
      <Helmet>
        <title>Contact | BURS</title>
        <meta name="description" content="Get in touch with the BURS team." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-xl mx-auto px-4 py-12 md:py-20">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4" />
            Tillbaka
          </Link>

          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Contact</h1>
            <p className="text-muted-foreground">Have questions? We're happy to help.</p>
          </div>

          <div className="text-center mb-10">
            <a href="mailto:hello@burs.se" className="text-primary hover:underline font-medium">
              hello@burs.se
            </a>
          </div>

          {status === 'success' ? (
            <div className="flex items-center justify-center gap-3 p-6 bg-primary/10 text-primary rounded-xl animate-fade-in">
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
        </div>
      </div>
    </>
  );
}

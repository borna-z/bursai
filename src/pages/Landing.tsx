import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Sparkles, Calendar, Shirt, Camera, Sun, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DrapeLogo } from '@/components/ui/DrapeLogo';

const features = [
  {
    icon: Sparkles,
    title: 'AI Outfit Generator',
    desc: 'Get perfectly matched outfits tailored to your occasion, weather, and personal style.',
  },
  {
    icon: Calendar,
    title: 'Smart Calendar Planning',
    desc: 'Sync your calendar and let AI suggest what to wear for every event in your week.',
  },
  {
    icon: Shirt,
    title: 'Digital Wardrobe',
    desc: 'Photograph, organize, and track every piece you own — all in one place.',
  },
];

const steps = [
  { num: '01', icon: Camera, title: 'Add your clothes', desc: 'Snap a photo — AI tags color, category, and style instantly.' },
  { num: '02', icon: Sun, title: 'Set your day', desc: 'Pick occasion and weather, or let the app pull it automatically.' },
  { num: '03', icon: Sparkles, title: 'Get styled', desc: 'Receive a complete outfit from your own wardrobe in seconds.' },
];

const trust = [
  { icon: Shield, title: 'Privacy-first', desc: 'Your data stays yours. No sharing, ever.' },
  { icon: Shield, title: 'No lock-in', desc: 'Cancel anytime. Export your data freely.' },
  { icon: Shield, title: 'Works offline', desc: 'Your wardrobe is always accessible.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>BURS | Your AI-Powered Personal Stylist</title>
        <meta name="description" content="BURS is your AI-powered personal stylist. Organize your wardrobe, plan outfits, and dress with confidence every day." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-6 text-center">
          <div className="animate-fade-in">
            <DrapeLogo variant="horizontal" size="xl" tinted={false} className="mb-6" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] max-w-2xl animate-fade-in animation-delay-100" style={{ fontFamily: "'Sora', sans-serif" }}>
            Your AI-powered<br />personal stylist
          </h1>
          <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-md animate-fade-in animation-delay-200">
            Organize your wardrobe, plan outfits, and dress with confidence — every single day.
          </p>
          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="mt-8 h-14 px-10 text-base font-semibold rounded-xl animate-fade-in animation-delay-300"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </section>

        {/* Features */}
        <section className="px-6 py-20 md:py-28">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-14 animate-fade-in">
              Everything you need to dress better
            </h2>
            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              {features.map((f, i) => (
                <div key={f.title} className={`text-center space-y-4 animate-fade-in animation-delay-${(i + 1) * 100}`}>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                    <f.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-20 md:py-28 bg-secondary/40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-14 animate-fade-in">
              Three steps to your best look
            </h2>
            <div className="grid md:grid-cols-3 gap-10">
              {steps.map((s, i) => (
                <div key={s.num} className={`relative space-y-3 animate-fade-in animation-delay-${(i + 1) * 100}`}>
                  <span className="text-5xl font-bold text-border">{s.num}</span>
                  <div className="flex items-center gap-3">
                    <s.icon className="w-5 h-5 text-foreground" />
                    <h3 className="text-base font-semibold">{s.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="px-6 py-20 md:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-14 animate-fade-in">
              Built on trust
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {trust.map((t, i) => (
                <div key={t.title} className={`space-y-3 animate-fade-in animation-delay-${(i + 1) * 100}`}>
                  <t.icon className="w-6 h-6 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="text-muted-foreground text-sm">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-20 md:py-28 bg-secondary/40">
          <div className="max-w-lg mx-auto text-center space-y-6 animate-fade-in">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to dress smarter?</h2>
            <p className="text-muted-foreground">Join thousands using BURS to simplify their morning routine.</p>
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="h-14 px-10 text-base font-semibold rounded-xl"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-10 border-t border-border">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <DrapeLogo variant="horizontal" size="sm" tinted={false} />
            <div className="flex gap-6">
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
              <a href="/contact" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <span>© {new Date().getFullYear()} BURS</span>
          </div>
        </footer>
      </div>
    </>
  );
}

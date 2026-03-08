import { useNavigate } from 'react-router-dom';
import bursLogo from '@/assets/burs-logo-white.png';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'AI Stylist', href: '#ai-stylist' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Use', href: '/terms' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help', href: '/contact' },
      { label: 'Sign In', href: '/auth' },
    ],
  },
];

export function LandingFooter() {
  const navigate = useNavigate();

  const handleClick = (href: string) => {
    if (href.startsWith('#')) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(href);
    }
  };

  return (
    <footer className="relative py-16 px-6 border-t border-[--lv2-border]">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 mb-4 md:mb-0">
            <img src={bursLogo} alt="BURS" className="h-5 mb-4 object-contain" />
            <a href="mailto:hello@burs.com" className="text-xs" style={{ color: 'var(--lv2-text-tertiary)' }}>
              hello@burs.com
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs tracking-[0.2em] uppercase font-medium mb-4" style={{ color: 'var(--lv2-text-tertiary)' }}>
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => handleClick(link.href)}
                      className="text-sm transition-colors duration-200 hover:text-white"
                      style={{ color: 'var(--lv2-text-secondary)' }}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[--lv2-border] pt-6 text-center">
          <p className="text-[11px] tracking-wide" style={{ color: 'var(--lv2-text-tertiary)' }}>
            © {new Date().getFullYear()} BURS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

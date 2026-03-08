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
      { label: 'Instagram', href: 'https://instagram.com/burs_style', external: true },
    ],
  },
];

export function LandingFooter() {
  const navigate = useNavigate();

  const handleClick = (link: { href: string; external?: boolean }) => {
    if (link.external) {
      window.open(link.href, '_blank', 'noopener,noreferrer');
    } else if (link.href.startsWith('#')) {
      document.getElementById(link.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(link.href);
    }
  };

  return (
    <footer className="relative py-20 px-6 border-t border-[--lv2-border]">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 mb-4 md:mb-0">
            <img src={bursLogo} alt="BURS" className="h-5 mb-3 object-contain" />
            <p className="text-[10px] tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--lv2-text-tertiary)' }}>
              AI Wardrobe Operating System
            </p>
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
                      onClick={() => handleClick(link)}
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

        <div className="border-t border-[--lv2-border] pt-8 text-center">
          <p className="text-[11px] tracking-wide" style={{ color: 'var(--lv2-text-tertiary)' }}>
            © {new Date().getFullYear()} BURS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

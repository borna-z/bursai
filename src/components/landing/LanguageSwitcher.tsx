import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES } from '@/i18n/translations';
import type { Locale } from '@/i18n/translations';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = SUPPORTED_LOCALES.find(l => l.code === locale);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-full text-xs text-gray-400 hover:text-white transition-colors border border-white/5 hover:border-white/10"
        aria-label="Change language"
      >
        <Globe size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">{current?.flag} {current?.name}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 glass-panel rounded-xl py-2 min-w-[180px] max-h-[300px] overflow-y-auto z-50 animate-fade-in">
          {SUPPORTED_LOCALES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code as Locale); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${l.code === locale ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

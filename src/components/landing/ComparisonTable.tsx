import { Check, X as XIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function ComparisonTable() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const rows = [
    { feature: t('landing.comp_garments'), free: '10', premium: t('landing.comp_unlimited') },
    { feature: t('landing.comp_outfits'), free: '10/' + t('landing.comp_month'), premium: t('landing.comp_unlimited') },
    { feature: t('landing.comp_ai'), free: t('landing.comp_basic'), premium: t('landing.comp_advanced') },
    { feature: t('landing.comp_weather'), free: true, premium: true },
    { feature: t('landing.comp_calendar'), free: false, premium: true },
    { feature: t('landing.comp_insights'), free: false, premium: true },
    { feature: t('landing.comp_chat'), free: false, premium: true },
    { feature: t('landing.comp_flatlay'), free: false, premium: true },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 mx-auto text-sm text-muted-foreground/50 hover:text-foreground transition-colors py-4">
        {t('landing.compare_plans')}
        <ChevronDown size={16} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-xl overflow-hidden max-w-2xl mx-auto mt-4 mb-8 border border-white/[0.06] reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-5 text-muted-foreground/60 font-normal text-xs">{t('landing.comp_feature')}</th>
                <th className="py-3 px-4 text-muted-foreground/60 font-normal text-xs text-center">{t('landing.free')}</th>
                <th className="py-3 px-4 text-foreground/80 font-medium text-xs text-center">
                  {t('landing.premium')}
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 align-middle">
                    {t('trial.badge')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-b border-white/[0.04] last:border-0 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="py-3 px-5 text-muted-foreground text-xs">{row.feature}</td>
                  <td className="py-3 px-4 text-center">
                    {typeof row.free === 'boolean' ? (
                      row.free ? <Check size={14} className="mx-auto text-muted-foreground/60" /> : <XIcon size={14} className="mx-auto text-muted-foreground/20" />
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">{row.free}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {typeof row.premium === 'boolean' ? (
                      row.premium ? <Check size={14} className="mx-auto text-foreground" /> : <XIcon size={14} className="mx-auto text-muted-foreground/20" />
                    ) : (
                      <span className="text-foreground font-medium text-xs">{row.premium}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

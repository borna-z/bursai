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
      <CollapsibleTrigger className="flex items-center gap-2 mx-auto text-sm text-gray-400 hover:text-white transition-colors py-4">
        {t('landing.compare_plans')}
        <ChevronDown size={16} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="glass-panel rounded-2xl overflow-hidden max-w-2xl mx-auto mt-4 mb-8 reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-4 px-6 text-gray-500 font-normal">{t('landing.comp_feature')}</th>
                <th className="py-4 px-4 text-gray-500 font-normal text-center">{t('landing.free')}</th>
                <th className="py-4 px-4 text-white font-medium text-center">{t('landing.premium')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="py-3.5 px-6 text-gray-300">{row.feature}</td>
                  <td className="py-3.5 px-4 text-center">
                    {typeof row.free === 'boolean' ? (
                      row.free ? <Check size={16} className="mx-auto text-gray-400" /> : <XIcon size={16} className="mx-auto text-gray-600" />
                    ) : (
                      <span className="text-gray-400">{row.free}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {typeof row.premium === 'boolean' ? (
                      row.premium ? <Check size={16} className="mx-auto text-white" /> : <XIcon size={16} className="mx-auto text-gray-600" />
                    ) : (
                      <span className="text-white font-medium">{row.premium}</span>
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

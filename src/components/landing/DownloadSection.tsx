import { useLanguage } from '@/contexts/LanguageContext';

export function DownloadSection() {
  const { t } = useLanguage();

  return (
    <section id="download" className="section-full px-6 section-gradient-top" style={{ zIndex: 15 }}>
      <div className="max-w-4xl mx-auto w-full py-20">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.download_label')}</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.download_title')}
        </h2>
        <p className="text-center text-gray-400 text-sm mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.download_desc')}
        </p>
        <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto stagger-reveal">
          {/* iPhone */}
          <div className="glass-panel rounded-2xl p-8 md:p-10 reveal-up tilt-card">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
              <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.iphone')}</h3>
            </div>
            <ol className="space-y-4 text-sm text-gray-400">
              {[
                [t('landing.iphone_step1_pre'), t('landing.iphone_step1_bold'), t('landing.iphone_step1_post')],
                [t('landing.iphone_step2_pre'), t('landing.iphone_step2_bold'), t('landing.iphone_step2_post')],
                [t('landing.iphone_step3_pre'), t('landing.iphone_step3_bold'), t('landing.iphone_step3_post')],
              ].map(([pre, strong, post], j) => (
                <li key={j} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">{j + 1}</span>
                  <span>{pre}<strong className="text-white">{strong}</strong>{post}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Android */}
          <div className="glass-panel rounded-2xl p-8 md:p-10 reveal-up tilt-card">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" /></svg>
              <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.android')}</h3>
            </div>
            <ol className="space-y-4 text-sm text-gray-400">
              {[
                [t('landing.android_step1_pre'), t('landing.android_step1_bold'), t('landing.android_step1_post')],
                [t('landing.android_step2_pre'), t('landing.android_step2_bold'), t('landing.android_step2_post')],
                [t('landing.android_step3_pre'), t('landing.android_step3_bold'), t('landing.android_step3_post')],
              ].map(([pre, strong, post], j) => (
                <li key={j} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">{j + 1}</span>
                  <span>{pre}<strong className="text-white">{strong}</strong>{post}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

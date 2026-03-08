import { useLanguage } from '@/contexts/LanguageContext';

/* ── Wardrobe Mock ── */
const GARMENTS = [
  { color: '#1B2A4A', label: 'Navy Blazer' },
  { color: '#F5F5F0', label: 'White Tee', textDark: true },
  { color: '#1A1A1A', label: 'Black Jeans' },
  { color: '#8B6914', label: 'Brown Boots' },
  { color: '#9CA3AF', label: 'Grey Knit' },
  { color: '#556B2F', label: 'Olive Chinos' },
];
const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Layers'];

function MockWardrobe() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#F6F4F1' }}>
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1">
        <span className="text-[10px] font-medium" style={{ color: '#1A1A1A' }}>9:41</span>
        <div className="flex gap-1">
          <div className="w-3 h-1.5 rounded-sm" style={{ background: '#1A1A1A' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1A1A1A' }} />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>My Wardrobe</h3>
        <p className="text-[10px] mt-0.5" style={{ color: '#888' }}>24 pieces</p>
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-hidden">
        {CATEGORIES.map((cat, i) => (
          <span
            key={cat}
            className="px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0"
            style={{
              background: i === 0 ? '#1A1A1A' : '#E8E6E1',
              color: i === 0 ? '#F6F4F1' : '#666',
            }}
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-1.5 px-4 flex-1">
        {GARMENTS.map((g) => (
          <div key={g.label} className="rounded-lg flex flex-col items-center justify-end pb-1.5 aspect-[3/4]" style={{ background: g.color }}>
            <span className="text-[7px] font-medium px-1 text-center leading-tight" style={{ color: g.textDark ? '#333' : '#fff' }}>
              {g.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex justify-around py-2 mt-auto border-t" style={{ borderColor: '#E8E6E1' }}>
        {['Home', 'Wardrobe', 'Outfits', 'Plan'].map((tab, i) => (
          <span key={tab} className="text-[8px] font-medium" style={{ color: i === 1 ? '#1A1A1A' : '#BBB' }}>{tab}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Today / Outfit Mock ── */
const OUTFIT_ITEMS = [
  { color: '#1B2A4A', label: 'Navy Blazer', slot: 'Layer' },
  { color: '#F5F5F0', label: 'White Tee', slot: 'Top', textDark: true },
  { color: '#2C2C2C', label: 'Dark Denim', slot: 'Bottom' },
  { color: '#8B6914', label: 'Brown Loafers', slot: 'Shoes' },
];

function MockOutfit() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#F6F4F1' }}>
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1">
        <span className="text-[10px] font-medium" style={{ color: '#1A1A1A' }}>9:41</span>
        <div className="flex gap-1">
          <div className="w-3 h-1.5 rounded-sm" style={{ background: '#1A1A1A' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1A1A1A' }} />
        </div>
      </div>

      {/* Greeting */}
      <div className="px-4 pt-2 pb-1">
        <p className="text-[10px]" style={{ color: '#888' }}>Good morning</p>
        <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Today's Outfit</h3>
      </div>

      {/* Badges */}
      <div className="flex gap-1.5 px-4 pb-3">
        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: '#E8E6E1', color: '#555' }}>
          ☀️ 14°C
        </span>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: '#E8E6E1', color: '#555' }}>
          Casual Friday
        </span>
      </div>

      {/* Outfit card */}
      <div className="mx-4 rounded-xl p-3 flex-1" style={{ background: '#FFFFFF' }}>
        <div className="grid grid-cols-2 gap-2">
          {OUTFIT_ITEMS.map((item) => (
            <div key={item.label} className="rounded-lg aspect-square flex flex-col items-center justify-end pb-1.5" style={{ background: item.color }}>
              <span className="text-[7px] font-medium" style={{ color: item.textDark ? '#333' : '#fff' }}>{item.label}</span>
              <span className="text-[6px] mt-0.5" style={{ color: item.textDark ? '#666' : 'rgba(255,255,255,0.6)' }}>{item.slot}</span>
            </div>
          ))}
        </div>

        {/* Explanation */}
        <p className="text-[8px] mt-2 leading-relaxed" style={{ color: '#888' }}>
          Classic smart-casual pairing. The navy blazer elevates the white tee, while brown loafers tie the look together.
        </p>

        {/* CTA */}
        <button className="w-full mt-2 py-1.5 rounded-lg text-[9px] font-semibold" style={{ background: '#1A1A1A', color: '#F6F4F1' }}>
          Wear This Today
        </button>
      </div>

      {/* Bottom nav */}
      <div className="flex justify-around py-2 mt-3 border-t" style={{ borderColor: '#E8E6E1' }}>
        {['Home', 'Wardrobe', 'Outfits', 'Plan'].map((tab, i) => (
          <span key={tab} className="text-[8px] font-medium" style={{ color: i === 0 ? '#1A1A1A' : '#BBB' }}>{tab}</span>
        ))}
      </div>
    </div>
  );
}

/* ── AI Chat Mock ── */
function MockChat() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#F6F4F1' }}>
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1">
        <span className="text-[10px] font-medium" style={{ color: '#1A1A1A' }}>9:41</span>
        <div className="flex gap-1">
          <div className="w-3 h-1.5 rounded-sm" style={{ background: '#1A1A1A' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1A1A1A' }} />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-2 pb-3 border-b" style={{ borderColor: '#E8E6E1' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>AI Stylist</h3>
        <p className="text-[9px]" style={{ color: '#888' }}>Your personal style assistant</p>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-2.5 overflow-hidden">
        {/* User message */}
        <div className="self-end max-w-[80%]">
          <div className="rounded-xl rounded-br-sm px-2.5 py-1.5" style={{ background: '#1A1A1A' }}>
            <p className="text-[9px] leading-relaxed" style={{ color: '#F6F4F1' }}>
              What should I wear to dinner tonight?
            </p>
          </div>
        </div>

        {/* AI response */}
        <div className="self-start max-w-[85%]">
          <div className="rounded-xl rounded-bl-sm px-2.5 py-2" style={{ background: '#FFFFFF' }}>
            <p className="text-[9px] leading-relaxed" style={{ color: '#1A1A1A' }}>
              For dinner tonight, I'd suggest your <span className="font-semibold">Navy Blazer</span> with the <span className="font-semibold">White Tee</span> underneath. Pair with <span className="font-semibold">Dark Denim</span> and <span className="font-semibold">Brown Loafers</span> for a smart-casual look.
            </p>
            {/* Mini garment chips */}
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {[
                { color: '#1B2A4A', label: 'Navy Blazer' },
                { color: '#F5F5F0', label: 'White Tee', textDark: true },
                { color: '#8B6914', label: 'Loafers' },
              ].map((chip) => (
                <span key={chip.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-medium" style={{ background: '#F0EDE8', color: '#555' }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: chip.color }} />
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* User follow-up */}
        <div className="self-end max-w-[80%]">
          <div className="rounded-xl rounded-br-sm px-2.5 py-1.5" style={{ background: '#1A1A1A' }}>
            <p className="text-[9px] leading-relaxed" style={{ color: '#F6F4F1' }}>
              Any accessories to add?
            </p>
          </div>
        </div>

        {/* AI accessory suggestion */}
        <div className="self-start max-w-[85%]">
          <div className="rounded-xl rounded-bl-sm px-2.5 py-2" style={{ background: '#FFFFFF' }}>
            <p className="text-[9px] leading-relaxed" style={{ color: '#1A1A1A' }}>
              A minimal silver watch and a dark brown leather belt would complete the look perfectly. Keep it understated.
            </p>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-3 pt-2 border-t" style={{ borderColor: '#E8E6E1' }}>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: '#FFFFFF' }}>
          <span className="text-[9px] flex-1" style={{ color: '#BBB' }}>Ask your stylist...</span>
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#1A1A1A' }}>
            <span className="text-[8px]" style={{ color: '#F6F4F1' }}>↑</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main showcase ── */
const SCREENS = [
  { Mock: MockWardrobe, labelKey: 'landing.showcase_wardrobe_label' },
  { Mock: MockOutfit, labelKey: 'landing.showcase_home_label' },
  { Mock: MockChat, labelKey: 'landing.showcase_chat_label' },
];

export function ProductShowcase() {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-20 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-up">
          {t('landing.product_label')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-space text-center mb-16 reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.product_title')}
        </h2>

        {/* Phone trio */}
        <div className="flex justify-center items-end gap-4 md:gap-8 mb-14">
          {SCREENS.map(({ Mock }, i) => {
            const isCenter = i === 1;
            const rotation = i === 0 ? '-rotate-3' : i === 2 ? 'rotate-3' : '';
            const size = isCenter ? 'phone-mockup phone-mockup-lg' : 'phone-mockup phone-mockup-sm';
            const opacity = isCenter ? '' : 'opacity-70';
            const translate = isCenter ? '' : 'translate-y-4';
            const hide = isCenter ? '' : 'hidden sm:block';

            return (
              <div
                key={i}
                className={`${size} ${rotation} ${opacity} ${translate} ${hide} ${isCenter ? 'relative z-10' : ''} reveal-up`}
                style={{ '--reveal-delay': `${i * 120 + 200}ms` } as React.CSSProperties}
              >
                <Mock />
              </div>
            );
          })}
        </div>

        {/* Callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
          {SCREENS.map(({ labelKey }, i) => (
            <p key={i} className="text-xs text-gray-500 tracking-wide reveal-up" style={{ '--reveal-delay': `${i * 80 + 400}ms` } as React.CSSProperties}>
              {t(labelKey)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

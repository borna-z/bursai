const ITEMS = [
  { label: 'Blazer', category: 'Outerwear', span: 'col-span-2 row-span-2' },
  { label: 'White Tee', category: 'Tops', span: '' },
  { label: 'Dark Denim', category: 'Bottoms', span: '' },
  { label: 'Linen Shirt', category: 'Tops', span: 'col-span-2' },
  { label: 'Sneakers', category: 'Shoes', span: '' },
  { label: 'Wool Coat', category: 'Outerwear', span: '' },
  { label: 'Silk Scarf', category: 'Accessories', span: '' },
  { label: 'Chinos', category: 'Bottoms', span: '' },
];

export function WardrobeVisualSection() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          Everything you own. Finally visible.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
          Bring structure to your wardrobe and make every piece easier to use.
        </p>
      </div>

      <div className="max-w-3xl mx-auto grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        {ITEMS.map((item, i) => (
          <div
            key={i}
            className={`lv2-card lv2-reveal lv2-reveal-delay-${(i % 4) + 1} group relative overflow-hidden ${item.span}`}
            style={{ minHeight: item.span.includes('row-span-2') ? 200 : 100 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[--lv2-surface] to-[--lv2-surface-elevated]" />
            {/* Hover metadata */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <span className="text-xs font-medium" style={{ color: 'var(--lv2-text-primary)' }}>{item.label}</span>
              <span className="text-[10px] tracking-wider uppercase mt-1" style={{ color: 'var(--lv2-text-tertiary)' }}>{item.category}</span>
            </div>
            {/* Default state */}
            <div className="absolute inset-0 flex items-end p-3 group-hover:opacity-0 transition-opacity duration-300">
              <span className="text-[10px] tracking-wider uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

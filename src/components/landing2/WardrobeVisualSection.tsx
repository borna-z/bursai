const ITEMS = [
  { label: 'Blazer', category: 'Outerwear', span: 'col-span-2 row-span-2', gradient: 'linear-gradient(135deg, #1a2535 0%, #2a3545 100%)', color: '#3a5068' },
  { label: 'White Tee', category: 'Tops', span: '', gradient: 'linear-gradient(135deg, #e8e4de 0%, #d5d0c8 100%)', color: '#e8e4de' },
  { label: 'Dark Denim', category: 'Bottoms', span: '', gradient: 'linear-gradient(135deg, #1a1e28 0%, #252a38 100%)', color: '#2a3040' },
  { label: 'Linen Shirt', category: 'Tops', span: 'col-span-2', gradient: 'linear-gradient(135deg, #c8bfb0 0%, #b8ae9e 100%)', color: '#c8bfb0' },
  { label: 'Sneakers', category: 'Shoes', span: '', gradient: 'linear-gradient(135deg, #f0ece6 0%, #e0dcd4 100%)', color: '#f0ece6' },
  { label: 'Wool Coat', category: 'Outerwear', span: '', gradient: 'linear-gradient(135deg, #3a2a20 0%, #4a3828 100%)', color: '#4a3828' },
  { label: 'Silk Scarf', category: 'Accessories', span: '', gradient: 'linear-gradient(135deg, #8b2040 0%, #a03050 100%)', color: '#a03050' },
  { label: 'Chinos', category: 'Bottoms', span: '', gradient: 'linear-gradient(135deg, #c4b8a0 0%, #b0a48c 100%)', color: '#b0a48c' },
];

export function WardrobeVisualSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <div className="max-w-4xl mx-auto text-center mb-20">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>Your wardrobe</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Everything you own. Finally visible.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          Bring structure to your wardrobe and make every piece easier to use.
        </p>
      </div>

      <div className="max-w-3xl mx-auto grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 lv2-stagger-grid">
        {ITEMS.map((item, i) => (
          <div
            key={i}
            className={`lv2-reveal group relative overflow-hidden rounded-xl cursor-default ${item.span}`}
            style={{
              minHeight: item.span.includes('row-span-2') ? 220 : 110,
              border: '1px solid var(--lv2-border)',
              transition: 'transform 0.5s cubic-bezier(0.25,0.1,0.25,1), box-shadow 0.5s ease',
            }}
          >
            {/* Fabric gradient background */}
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]" style={{ background: item.gradient }} />

            {/* Color dot */}
            <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full opacity-60 group-hover:opacity-100 transition-opacity z-10" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}40` }} />

            {/* Hover metadata */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400 z-10" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
              <span className="text-xs font-medium" style={{ color: '#F5F7FA' }}>{item.label}</span>
              <span className="text-[10px] tracking-wider uppercase mt-1" style={{ color: '#A7B1C2' }}>{item.category}</span>
            </div>

            {/* Default label */}
            <div className="absolute inset-0 flex items-end p-3 group-hover:opacity-0 transition-opacity duration-400">
              <span className="text-[10px] tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

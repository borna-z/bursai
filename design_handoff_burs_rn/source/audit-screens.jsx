/* eslint-disable */
/* Audit screens — all the missing pages identified by the codebase audit.
   Adds: Insights (full), MoodOutfit, EditGarment, UnusedOutfits, UsedGarments,
         5 Settings sub-pages, ResetPassword, NotFound, ShareOutfit, PublicProfile,
         Billing Success/Cancel, plus PickMustHaves + PackingList for Travel Capsule.
   Also exports an upgraded StyleChatScreen with history drawer + memory panel. */

const { useState: useStateA, useRef: useRefA } = React;

// ============================================================
// SHARED — small helpers (use existing ScreenShell from extra-screens.jsx)
// ============================================================
const Shell = window.ScreenShell;

// Skeleton block — used for loading states
function Skeleton({ w = '100%', h = 16, r = 8, style }) {
  return (
    <div
      className="skeleton-block"
      style={{
        width: w, height: h, borderRadius: r,
        background: 'linear-gradient(90deg, var(--bg-2) 0%, var(--card-2) 50%, var(--bg-2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function Spinner({ size = 22 }) {
  return (
    <div style={{ display:'inline-block', width:size, height:size, position:'relative' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation:'spin 0.9s linear infinite' }}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border)" strokeWidth="2" />
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('audit-anim')) {
  const s = document.createElement('style');
  s.id = 'audit-anim';
  s.textContent = `
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes pulse-soft { 0%,100%{opacity:1} 50%{opacity:.55} }
@keyframes float-up { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
@keyframes draw-check { from { stroke-dashoffset: 60 } to { stroke-dashoffset: 0 } }
.fade-in { animation: float-up 320ms ease both; }
`;
  document.head.appendChild(s);
}

// ============================================================
// 1. INSIGHTS (full screen)
// ============================================================
function InsightsFullScreen() {
  const nav = useNav();
  const [period, setPeriod] = useStateA('30d');
  const [loading, setLoading] = useStateA(true);
  React.useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, [period]);

  // Use the same Gauge component the Home Insights tab uses
  const Gauge = window.Gauge;

  // Match Home Insights palette + viz exactly
  const bars = [40, 65, 30, 80, 55, 72, 90, 48, 60, 35, 70, 55];
  const palette = [
    { name: 'Cream',    hex: '#EDE3D2', pct: 28 },
    { name: 'Charcoal', hex: '#2A2622', pct: 22 },
    { name: 'Camel',    hex: '#B98E5A', pct: 16 },
    { name: 'Olive',    hex: '#6B6B3F', pct: 12 },
    { name: 'Slate',    hex: '#7A8089', pct: 10 },
    { name: 'Rust',     hex: '#A85432', pct:  7 },
    { name: 'Other',    hex: '#C9C0AE', pct:  5 },
  ];

  if (loading) {
    return (
      <Shell title="Insights" eyebrow={`LAST ${period.toUpperCase()}`} withTabBar="insights">
        <div className="chip-row">
          {['7d','30d','90d','1y'].map(p => <button key={p} className={`chip-pill${p===period?' active':''}`} onClick={() => { setPeriod(p); setLoading(true); }}>{p}</button>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
          <Skeleton h={70} r={14} /><Skeleton h={70} r={14} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8 }}>
          <Skeleton h={130} r={16}/><Skeleton h={130} r={16}/><Skeleton h={130} r={16}/>
        </div>
        <Skeleton h={180} r={20} />
        <Skeleton h={180} r={20} />
      </Shell>
    );
  }

  return (
    <Shell title="Insights" eyebrow={`LAST ${period.toUpperCase()}`} withTabBar="insights">
      {/* Period chips */}
      <div className="chip-row">
        {['7d','30d','90d','1y'].map(p => (
          <button key={p} className={`chip-pill${p===period?' active':''}`} onClick={() => { setPeriod(p); setLoading(true); }}>{p}</button>
        ))}
      </div>

      {/* Stats — same as Home tab */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }} className="fade-in">
        <div className="stat-block"><div className="num">23</div><div className="lbl">Outfits worn</div></div>
        <div className="stat-block"><div className="num">68%</div><div className="lbl">Wardrobe used</div></div>
      </div>

      {/* Three gauges — at-a-glance health */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8 }} className="fade-in">
        {Gauge ? (
          <>
            <Gauge value={82} max={100} unit="%" label="Cost / wear efficiency" delta="18%" deltaDir="up" />
            <Gauge value={47} max={100} unit="%" label="Outfit variety" delta="6 new combos" deltaDir="up" />
            <Gauge value={91} max={100} unit="%" label="Care & laundry on time" delta="2 overdue" deltaDir="down" />
          </>
        ) : null}
      </div>

      {/* Wardrobe palette */}
      <div className="card fade-in">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <p className="eyebrow">Your palette</p>
          <span className="caption">Share of wears</span>
        </div>
        <div className="palette-row">
          <div className="palette-bar">
            {palette.map((c, i) => (
              <div key={i} className="seg" style={{ flex: c.pct, background: c.hex }} title={`${c.name} · ${c.pct}%`} />
            ))}
          </div>
          <div className="palette-legend">
            {palette.map((c, i) => (
              <div key={i} className="item">
                <span className="swatch" style={{ background: c.hex }} />
                <span className="name">{c.name}</span>
                <span className="pct">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wear frequency bars */}
      <div className="card fade-in">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <p className="eyebrow">Wear frequency</p>
          <span className="caption">Top categories</span>
        </div>
        <div className="bar-viz">
          {bars.map((h, i) => (
            <div key={i} className={`bar${h > 65 ? ' hi' : ''}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10 }}>
          <span className="caption">Mar 28</span>
          <span className="caption">Apr 26</span>
        </div>
      </div>

      {/* Most worn */}
      <section className="fade-in">
        <p className="eyebrow" style={{ marginBottom: 10 }}>Most worn</p>
        <div style={{ display:'flex', flexDirection:'column' }}>
          {[
            ['Cream linen trouser', '11 wears', 32],
            ['Wool overshirt', '9 wears', 38],
            ['White oxford', '7 wears', 200],
            ['Black denim', '7 wears', 28],
            ['Bone sneaker', '5 wears', 32],
          ].map(([n, w, hue], i, arr) => (
            <button key={i} onClick={() => nav.push({ id:'garment', props:{ name: n }})} style={{
              all:'unset', cursor:'pointer',
              display:'flex', alignItems:'center', gap: 12, padding:'10px 0',
              borderBottom: i<arr.length-1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink:0, background:`linear-gradient(135deg, hsl(${hue} 32% 78%), hsl(${(hue+30)%360} 26% 62%))` }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color:'var(--fg)', letterSpacing:'-0.01em' }}>{n}</p>
                <p className="caption" style={{ fontSize: 11 }}>{w}</p>
              </div>
              <span className="display" style={{ fontSize: 18, color:'var(--accent)' }}>{i+1}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Cost-per-wear note (now small, not the header) */}
      <div className="card-hero fade-in">
        <p className="eyebrow" style={{ marginBottom: 8 }}>Quiet win</p>
        <p className="display" style={{ fontSize: 19, lineHeight: 1.3, color:'var(--fg)' }}>Your cost-per-wear dropped 18% — the cashmere is finally pulling its weight.</p>
        <p className="caption" style={{ fontSize: 11.5, marginTop: 8 }}>Average $2.18 / wear · 142 wears this period</p>
      </div>

      {/* Footer actions */}
      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => nav.push('unusedOutfits')}>Unused outfits</button>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => nav.push('usedGarments')}>Most worn</button>
      </div>
    </Shell>
  );
}

// ============================================================
// 2. MOOD OUTFIT (standalone — different from Style Me)
// ============================================================
function MoodFlowScreen() {
  const nav = useNav();
  const [step, setStep] = useStateA('pick'); // pick | generating | result
  const [mood, setMood] = useStateA(null);
  const moods = [
    { id:'calm', label:'Calm', sub:'soft, grounded', hue: 32 },
    { id:'sharp', label:'Sharp', sub:'crisp, focused', hue: 220 },
    { id:'cool', label:'Cool', sub:'blue, easy', hue: 200 },
    { id:'bold', label:'Bold', sub:'saturated, confident', hue: 18 },
    { id:'soft', label:'Soft', sub:'pastel, tender', hue: 350 },
    { id:'moody', label:'Moody', sub:'low, layered', hue: 280 },
    { id:'rich', label:'Rich', sub:'warm, lived-in', hue: 38 },
    { id:'bright', label:'Bright', sub:'open, daylit', hue: 45 },
  ];

  if (step === 'pick') {
    return (
      <Shell title="Mood" eyebrow="HOW DO YOU WANT TO FEEL?">
        <div>
          <h1 className="page-title" style={{ fontSize: 30, marginBottom: 4 }}>Pick a feeling.</h1>
          <p style={{ fontSize: 13, color:'var(--fg-2)' }}>We'll style around it — color, texture, silhouette.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
          {moods.map(m => (
            <button key={m.id} onClick={() => setMood(m)} style={{
              all:'unset', cursor:'pointer', padding: 16, borderRadius: 18,
              border: mood?.id === m.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: `linear-gradient(135deg, hsl(${m.hue} 30% 78%) 0%, var(--card) 70%)`,
              minHeight: 110, display:'flex', flexDirection:'column', justifyContent:'flex-end',
            }}>
              <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 22, fontWeight: 500, color:'var(--fg)' }}>{m.label}</span>
              <span className="caption" style={{ fontSize: 11.5 }}>{m.sub}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-block" disabled={!mood} onClick={() => { setStep('generating'); setTimeout(() => setStep('result'), 1400); }}>
          Style this mood
        </button>
      </Shell>
    );
  }

  if (step === 'generating') {
    return (
      <Shell title="Mood" eyebrow={mood.label.toUpperCase()}>
        <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 16, padding: '40px 0' }}>
          <div style={{ position:'relative', width: 120, height: 120 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                position:'absolute', inset: 0, borderRadius:'50%',
                border:'2px solid var(--accent)',
                opacity: 0,
                animation: `pulse-ring 1.6s ${i*0.4}s ease-out infinite`,
              }} />
            ))}
            <div style={{ position:'absolute', inset: 30, borderRadius:'50%', background: `radial-gradient(circle, hsl(${mood.hue} 50% 70%), transparent 70%)`, animation:'pulse-soft 1.4s ease-in-out infinite' }} />
          </div>
          <p style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 22, color:'var(--fg)' }}>Reading the mood…</p>
          <p className="caption">Pulling pieces that hold "{mood.label.toLowerCase()}"</p>
        </div>
        <style>{`@keyframes pulse-ring { 0% { transform: scale(0.6); opacity: 0.8 } 100% { transform: scale(1.4); opacity: 0 } }`}</style>
      </Shell>
    );
  }

  // result
  return (
    <Shell title="Mood" eyebrow={`${mood.label.toUpperCase()} · STYLED`} action={{ label: 'Restart', onClick: () => setStep('pick') }}>
      <div className="card-hero fade-in" style={{ background: `linear-gradient(135deg, hsl(${mood.hue} 30% 78%), var(--card))` }}>
        <p className="eyebrow">Today's mood</p>
        <h1 className="display" style={{ fontSize: 32 }}>{mood.label}</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)' }}>{mood.sub}</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
        {[
          [`${mood.label} · soft`, [mood.hue, (mood.hue+20)%360, 28, 200]],
          [`${mood.label} · sharp`, [(mood.hue+10)%360, 28, 200, mood.hue]],
        ].map(([n, hues], i) => (
          <button key={i} className="fade-in" onClick={() => nav.push({ id:'outfit', props:{ name: n, kicker:'MOOD' }})} style={{ all:'unset', cursor:'pointer', animationDelay:`${i*120}ms` }}>
            <window.OutfitCard name={n} sub="4 PIECES" hues={hues} />
          </button>
        ))}
      </div>
      <button className="btn btn-outline btn-block" onClick={() => setStep('pick')}>Try another mood</button>
    </Shell>
  );
}

// ============================================================
// 3. EDIT GARMENT
// ============================================================
function EditGarmentScreen({ name = 'Linen tee', hue = 32 } = {}) {
  const nav = useNav();
  const [n, setN] = useStateA(name);
  const [cat, setCat] = useStateA('Tops');
  const [color, setColor] = useStateA('Cream');
  const [brand, setBrand] = useStateA('—');
  const [season, setSeason] = useStateA(['Spring','Summer']);
  const [saving, setSaving] = useStateA(false);

  const toggleSeason = (s) => setSeason(season.includes(s) ? season.filter(x=>x!==s) : [...season, s]);

  return (
    <Shell title="Edit piece" onBack={nav.pop} action={{ label: saving ? '…' : 'Save', onClick: () => { setSaving(true); setTimeout(() => nav.pop(), 800); } }}>
      {/* Hero photo */}
      <div style={{ display:'flex', gap: 12 }}>
        <div style={{ width: 90, height: 120, borderRadius: 14, background:`linear-gradient(135deg, hsl(${hue} 32% 78%), hsl(${(hue+30)%360} 26% 62%))`, border:'1px solid var(--border)' }} />
        <div style={{ flex: 1, display:'flex', flexDirection:'column', gap: 6, justifyContent:'center' }}>
          <button className="btn btn-outline" style={{ alignSelf:'flex-start' }}>Replace photo</button>
          <button className="btn-quiet" style={{ background:'transparent', border:0, color:'var(--accent)', fontSize: 13, fontWeight: 500, cursor:'pointer', textAlign:'left', padding: 0 }}>Remove background</button>
        </div>
      </div>

      {/* Name */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Name</p>
        <input className="composer-input" value={n} onChange={e => setN(e.target.value)} style={{ borderRadius: 12, padding: 12 }} />
      </div>

      {/* Category */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Category</p>
        <div className="chip-row">
          {['Tops','Bottoms','Outerwear','Shoes','Accessories','Bags'].map(c => (
            <button key={c} className={`chip-pill${c===cat?' active':''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Color + Brand */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Color</p>
          <input className="composer-input" value={color} onChange={e => setColor(e.target.value)} style={{ borderRadius: 12, padding: 12 }} />
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Brand</p>
          <input className="composer-input" value={brand} onChange={e => setBrand(e.target.value)} style={{ borderRadius: 12, padding: 12 }} />
        </div>
      </div>

      {/* Seasons */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Seasons</p>
        <div className="chip-row">
          {['Spring','Summer','Fall','Winter'].map(s => (
            <button key={s} className={`chip-pill${season.includes(s)?' active':''}`} onClick={() => toggleSeason(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Care */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Care</p>
        <div className="card" style={{ padding: 4 }}>
          {[['Machine wash cold', true], ['Tumble dry low', false], ['Iron warm', true]].map(([l, on], i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderBottom: i<2?'1px solid var(--border)':'none' }}>
              <span style={{ fontSize: 13.5 }}>{l}</span>
              <Toggle initial={on} />
            </div>
          ))}
        </div>
      </div>

      <button className="btn-quiet" style={{ background:'transparent', border:0, color:'#c44', fontSize: 13, fontWeight: 500, cursor:'pointer', alignSelf:'center', padding: '10px 0' }}>Delete piece</button>

      {saving && <LoadingOverlay label="Saving…" />}
    </Shell>
  );
}

function Toggle({ initial = false }) {
  const [on, setOn] = useStateA(initial);
  return (
    <button onClick={() => setOn(!on)} style={{
      width: 44, height: 26, borderRadius: 13, border: 0, padding: 2, cursor:'pointer',
      background: on ? 'var(--accent)' : 'var(--border-2)',
      transition: 'background 200ms',
      position:'relative',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11, background: 'white',
        transform: on ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 200ms ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}/>
    </button>
  );
}

function LoadingOverlay({ label = 'Loading…' }) {
  return (
    <div style={{ position:'absolute', inset: 0, background:'color-mix(in oklab, var(--bg) 80%, transparent)', backdropFilter:'blur(8px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 14, zIndex: 100 }}>
      <Spinner size={32} />
      <p style={{ fontSize: 13, color:'var(--fg-2)' }}>{label}</p>
    </div>
  );
}

// ============================================================
// 4. UNUSED OUTFITS
// ============================================================
function UnusedOutfitsScreen() {
  const nav = useNav();
  const items = [
    ['Weekend run', '94 days idle', [120, 200, 32, 45]],
    ['Boardroom', '67 days idle', [220, 28, 200, 18]],
    ['Date — soft', '54 days idle', [350, 32, 28, 18]],
    ['Concert', '42 days idle', [280, 18, 28, 200]],
    ['Beach walk', '38 days idle', [200, 32, 38, 18]],
  ];
  return (
    <Shell title="Unused outfits" eyebrow="HAVEN'T BEEN WORN">
      <div className="card-hero fade-in">
        <p className="eyebrow">Idle since 30+ days</p>
        <h1 className="display" style={{ fontSize: 32, lineHeight: 1.1 }}>5 outfits waiting</h1>
        <p style={{ fontSize: 12.5, color:'var(--fg-2)', marginTop: 6 }}>Reshuffle or schedule one this week.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
        {items.map(([n, sub, hues], i) => (
          <button key={i} onClick={() => nav.push({ id:'outfit', props:{ name: n, kicker:'UNUSED' }})} style={{ all:'unset', cursor:'pointer' }} className="fade-in">
            <window.OutfitCard name={n} sub={sub} hues={hues} />
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ============================================================
// 5. USED GARMENTS
// ============================================================
function UsedGarmentsScreen() {
  const nav = useNav();
  const items = [
    ['Linen tee', 32, 12], ['Wool overshirt', 38, 9], ['Black denim', 28, 7],
    ['White oxford', 200, 6], ['Cream knit', 32, 5], ['Sand chore', 45, 4],
    ['Bone sneaker', 32, 4], ['Charcoal trouser', 220, 3],
  ];
  return (
    <Shell title="Recently worn" eyebrow="LAST 30 DAYS">
      <p style={{ fontSize: 13, color:'var(--fg-2)' }}>{items.length} pieces · sorted by wear count</p>
      <div className="card" style={{ padding: 4 }}>
        {items.map(([n, hue, w], i) => (
          <button key={i} onClick={() => nav.push({ id:'garment', props:{ name: n }})} style={{
            all:'unset', cursor:'pointer', display:'flex', alignItems:'center', gap: 12,
            padding:'10px 12px', borderBottom: i<items.length-1?'1px solid var(--border)':'none',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background:`linear-gradient(135deg, hsl(${hue} 30% 75%), hsl(${(hue+30)%360} 25% 60%))` }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 500 }}>{n}</p>
              <p className="caption" style={{ fontSize: 11 }}>{w} wears</p>
            </div>
            <span className="display" style={{ fontSize: 18, color:'var(--accent)' }}>{i+1}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ============================================================
// 6. SETTINGS sub-pages — Appearance, Style, Notifications, Account, Privacy
// ============================================================
function SettingsAppearanceScreen() {
  const nav = useNav();
  const [theme, setTheme] = useStateA(nav.theme);
  const [accent, setAccent] = useStateA('warm-gold');
  const accents = [
    ['warm-gold', 'hsl(37 47% 46%)', 'Warm gold'],
    ['terracotta', 'hsl(15 50% 50%)', 'Terracotta'],
    ['olive', 'hsl(75 30% 38%)', 'Olive'],
    ['ink', 'hsl(220 30% 25%)', 'Ink'],
  ];
  return (
    <Shell title="Appearance" eyebrow="SETTINGS">
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Theme</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8 }}>
          {[['light','Light'],['dark','Dark'],['auto','System']].map(([id, l]) => (
            <button key={id} onClick={() => { setTheme(id); if (id !== 'auto' && id !== nav.theme) nav.toggleTheme(); }} style={{
              all:'unset', cursor:'pointer', padding: 14, borderRadius: 14, textAlign:'center',
              border: theme===id?'2px solid var(--accent)':'1px solid var(--border)',
              background: id==='light'?'#fbf7f0':id==='dark'?'#1a1816':'linear-gradient(135deg,#fbf7f0 50%,#1a1816 50%)',
              color: id==='dark'?'#fff':'#1a1816',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{l}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Accent color</p>
        <div className="card" style={{ padding: 4 }}>
          {accents.map(([id, c, l], i) => (
            <button key={id} onClick={() => setAccent(id)} style={{
              all:'unset', cursor:'pointer', display:'flex', alignItems:'center', gap: 12,
              padding: '12px 14px', borderBottom: i<accents.length-1?'1px solid var(--border)':'none',
            }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: c, border:'1px solid var(--border)' }} />
              <span style={{ flex: 1, fontSize: 14 }}>{l}</span>
              {accent===id && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="m20 6-11 11-5-5"/></svg>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Text size</p>
        <div className="card" style={{ padding: 16 }}>
          <input type="range" min={0} max={4} defaultValue={2} style={{ width:'100%', accentColor:'var(--accent)' }} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11 }}>A</span><span style={{ fontSize: 18 }}>A</span>
          </div>
        </div>
      </div>

      <SettingRow label="Reduce motion" toggle initial={false} />
      <SettingRow label="High contrast" toggle initial={false} />
    </Shell>
  );
}

function SettingsStyleScreen() {
  const [tags, setTags] = useStateA(['Minimal','Editorial','Earth tones']);
  const [sizes, setSizes] = useStateA({ top: 'M', bottom: '32', shoe: '10' });
  const [climate, setClimate] = useStateA('Mediterranean · 12-28°');
  const [budget, setBudget] = useStateA('Mid');
  const styleTags = ['Minimal','Editorial','Streetwear','Classic','Preppy','Earth tones','Monochrome','Cool tones','Warm tones','Sporty','Tailored','Vintage'];

  return (
    <Shell title="Style profile" eyebrow="SETTINGS">
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Aesthetic</p>
        <div className="chip-row">
          {styleTags.map(t => (
            <button key={t} className={`chip-pill${tags.includes(t)?' active':''}`} onClick={() => setTags(tags.includes(t)?tags.filter(x=>x!==t):[...tags, t])}>{t}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Sizes</p>
        <div className="card" style={{ padding: 4 }}>
          {[['Tops', 'top', ['XS','S','M','L','XL']],
            ['Bottoms', 'bottom', ['28','30','32','34','36']],
            ['Shoes', 'shoe', ['8','9','10','11','12']]].map(([l, k, opts], i) => (
            <div key={k} style={{ padding:'12px 14px', borderBottom: i<2?'1px solid var(--border)':'none' }}>
              <p style={{ fontSize: 12, color:'var(--fg-2)', marginBottom: 6 }}>{l}</p>
              <div style={{ display:'flex', gap: 4 }}>
                {opts.map(o => (
                  <button key={o} onClick={() => setSizes({ ...sizes, [k]: o })} style={{
                    all:'unset', cursor:'pointer', flex: 1, textAlign:'center', padding:'8px 0',
                    borderRadius: 8, fontSize: 13,
                    border: sizes[k]===o?'2px solid var(--accent)':'1px solid var(--border)',
                    color: sizes[k]===o?'var(--accent)':'var(--fg)',
                    fontWeight: sizes[k]===o?500:400,
                  }}>{o}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Climate</p>
        <input className="composer-input" value={climate} onChange={e => setClimate(e.target.value)} style={{ borderRadius: 12, padding: 12 }} />
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Budget</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 6 }}>
          {['Easy','Mid','Premium'].map(b => (
            <button key={b} onClick={() => setBudget(b)} style={{
              all:'unset', cursor:'pointer', textAlign:'center', padding:'12px 0', borderRadius: 12,
              border: budget===b?'2px solid var(--accent)':'1px solid var(--border)',
              fontSize: 13, fontWeight: 500,
              background: budget===b?'var(--accent-soft)':'transparent',
            }}>{b}</button>
          ))}
        </div>
      </div>

      <button className="btn btn-block">Save preferences</button>
    </Shell>
  );
}

function SettingsNotificationsScreen() {
  return (
    <Shell title="Notifications" eyebrow="SETTINGS">
      <p style={{ fontSize: 13, color:'var(--fg-2)' }}>What you'd like Burs to ping you about.</p>
      <div className="card" style={{ padding: 4 }}>
        {[
          ['Daily outfit', 'Every morning at 7:30 AM', true],
          ['Weather changes', 'When the day deviates from forecast', true],
          ['Calendar match', 'When you have an event needing styling', false],
          ['Wardrobe streaks', 'Wear-rate milestones', true],
          ['Idle pieces', 'When something hasn\'t been worn 60+ days', false],
          ['Stylist replies', 'When the AI stylist messages you', true],
        ].map(([l, sub, on], i, arr) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding:'12px 14px', borderBottom: i<arr.length-1?'1px solid var(--border)':'none' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 500 }}>{l}</p>
              <p className="caption" style={{ fontSize: 11 }}>{sub}</p>
            </div>
            <Toggle initial={on} />
          </div>
        ))}
      </div>
      <SettingRow label="Quiet hours" sub="22:00 – 07:00" link />
    </Shell>
  );
}

function SettingsAccountScreen() {
  const nav = useNav();
  return (
    <Shell title="Account" eyebrow="SETTINGS">
      <div className="card-hero fade-in">
        <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 70%, black))', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-fg)', fontSize: 22, fontWeight: 600 }}>A</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 500 }}>Anna Lindqvist</p>
            <p className="caption" style={{ fontSize: 12 }}>anna@burs.app</p>
          </div>
        </div>
      </div>

      <SettingRow label="Email" sub="anna@burs.app" link />
      <SettingRow label="Username" sub="@anna.l" link />
      <SettingRow label="Phone" sub="Not added" link />
      <SettingRow label="Password" sub="Last changed 3 months ago" link onClick={() => nav.push('resetPassword')} />

      <div style={{ marginTop: 8 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Connected</p>
        <div className="card" style={{ padding: 4 }}>
          {[['Apple','signed in', true],['Google Calendar','connected', true],['Spotify','not connected', false]].map(([l, s, c], i, arr) => (
            <div key={l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom: i<arr.length-1?'1px solid var(--border)':'none' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500 }}>{l}</p>
                <p className="caption" style={{ fontSize: 11 }}>{s}</p>
              </div>
              <button className="btn-quiet" style={{ background:'transparent', border:0, color: c?'var(--fg-2)':'var(--accent)', fontSize: 13, fontWeight: 500, cursor:'pointer' }}>{c?'Disconnect':'Connect'}</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button className="btn btn-outline btn-block">Sign out</button>
        <button onClick={() => nav.push('deleteAccount')} className="btn-quiet" style={{ marginTop: 12, background:'transparent', border:0, color:'#c44', fontSize: 13, fontWeight: 500, cursor:'pointer', padding:'10px 0', width:'100%' }}>Delete account</button>
      </div>
    </Shell>
  );
}

function SettingsPrivacyScreen() {
  return (
    <Shell title="Privacy" eyebrow="SETTINGS">
      <p style={{ fontSize: 13, color:'var(--fg-2)' }}>Control what's shared and what's used to train your stylist.</p>

      <div className="card" style={{ padding: 4 }}>
        {[
          ['Personalize stylist', 'Use your wardrobe data to improve recs', true],
          ['Share anonymized trends', 'Help the community color/style charts', false],
          ['Public profile', 'Discoverable at burs.app/u/anna.l', false],
          ['Calendar reading', 'Pull events to suggest outfits', true],
          ['Weather location', 'Use device location for forecasts', true],
        ].map(([l, sub, on], i, arr) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding:'12px 14px', borderBottom: i<arr.length-1?'1px solid var(--border)':'none' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 500 }}>{l}</p>
              <p className="caption" style={{ fontSize: 11 }}>{sub}</p>
            </div>
            <Toggle initial={on} />
          </div>
        ))}
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Your data</p>
        <SettingRow label="Download my data" sub="Get a copy as ZIP" link />
        <SettingRow label="Reset stylist memory" sub="Forget what it knows" link />
        <SettingRow label="Clear search history" link />
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Legal</p>
        <SettingRow label="Privacy policy" link />
        <SettingRow label="Terms of service" link />
      </div>
    </Shell>
  );
}

function SettingRow({ label, sub, toggle, link, initial = false, onClick }) {
  return (
    <button onClick={onClick} style={{
      all:'unset', cursor: link||onClick||toggle?'pointer':'default',
      display:'flex', alignItems:'center', gap: 10,
      padding:'13px 14px', borderRadius: 14, border:'1px solid var(--border)',
      background:'var(--card)',
      width:'100%', boxSizing:'border-box',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500 }}>{label}</p>
        {sub && <p className="caption" style={{ fontSize: 11 }}>{sub}</p>}
      </div>
      {toggle && <Toggle initial={initial} />}
      {link && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="1.6" strokeLinecap="round"><path d="m9 6 6 6-6 6"/></svg>}
    </button>
  );
}

// ============================================================
// 7. RESET PASSWORD
// ============================================================
function ResetPasswordScreen() {
  const nav = useNav();
  const [step, setStep] = useStateA('email');
  const [email, setEmail] = useStateA('');
  const [submitting, setSubmitting] = useStateA(false);

  if (step === 'sent') {
    return (
      <Shell title="Reset password" onBack={() => nav.pop()}>
        <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 16, padding: '40px 20px', textAlign:'center' }}>
          <div style={{ width: 64, height: 64, borderRadius:'50%', background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fade-in">
              <path d="M4 4h16v16H4z"/><path d="m4 4 8 8 8-8"/>
            </svg>
          </div>
          <h1 className="page-title" style={{ fontSize: 26 }}>Check your email</h1>
          <p style={{ fontSize: 13.5, color:'var(--fg-2)', maxWidth: 280 }}>We sent a reset link to <b>{email}</b>. It expires in 1 hour.</p>
          <button className="btn-quiet" onClick={() => setStep('email')} style={{ background:'transparent', border:0, color:'var(--accent)', fontSize: 13, fontWeight: 500, cursor:'pointer' }}>Use a different email</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Reset password" onBack={() => nav.pop()}>
      <div>
        <h1 className="page-title" style={{ fontSize: 28, marginBottom: 6 }}>Forgot password?</h1>
        <p style={{ fontSize: 13.5, color:'var(--fg-2)' }}>Enter your email and we'll send you a reset link.</p>
      </div>
      <input className="composer-input" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ borderRadius: 14, padding: 14 }} type="email" />
      <button className="btn btn-block" disabled={!email.includes('@') || submitting} onClick={() => { setSubmitting(true); setTimeout(() => setStep('sent'), 900); }}>
        {submitting ? <Spinner size={16}/> : 'Send reset link'}
      </button>
      <button className="btn-quiet" onClick={nav.pop} style={{ background:'transparent', border:0, color:'var(--fg-2)', fontSize: 13, cursor:'pointer', padding: '8px 0' }}>Back to sign in</button>
    </Shell>
  );
}

// ============================================================
// 8. NOT FOUND (404)
// ============================================================
function NotFoundScreen() {
  const nav = useNav();
  return (
    <Shell title="404">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 16, padding: '40px 20px', textAlign:'center' }}>
        <div style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 96, lineHeight: 1, color:'var(--accent)' }}>404</div>
        <h1 className="page-title" style={{ fontSize: 26 }}>Lost in the wardrobe</h1>
        <p style={{ fontSize: 13.5, color:'var(--fg-2)', maxWidth: 280 }}>This page doesn't exist — or it got moved while we were folding.</p>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn" onClick={() => nav.replace('home')}>Home</button>
          <button className="btn btn-outline" onClick={nav.pop}>Go back</button>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// 9. SHARE OUTFIT (public-facing card)
// ============================================================
function ShareOutfitScreen() {
  const nav = useNav();
  const [copied, setCopied] = useStateA(false);
  return (
    <Shell title="Share outfit" onBack={nav.pop}>
      <div className="card-hero fade-in" style={{ textAlign:'center', padding: 20 }}>
        <p className="eyebrow">Studio brunch</p>
        <h1 className="page-title" style={{ fontSize: 24, marginBottom: 8 }}>by @anna.l</h1>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6, padding: 12 }}>
          {[32, 38, 200, 28].map((h, i) => (
            <div key={i} style={{ aspectRatio: '3/4', borderRadius: 10, background:`linear-gradient(135deg, hsl(${h} 32% 78%), hsl(${(h+30)%360} 26% 62%))` }} />
          ))}
        </div>
        <p style={{ fontSize: 12.5, color:'var(--fg-2)', marginTop: 8 }}>4 pieces · curated by Burs</p>
      </div>

      {/* Shareable link */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap: 8, padding: 12 }}>
        <span style={{ flex: 1, fontSize: 12, color:'var(--fg-2)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>burs.app/share/oo7Xz3</span>
        <button className="btn" style={{ padding:'8px 14px' }} onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Share targets */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8 }}>
        {[
          ['Messages', 'M'],
          ['Mail', '@'],
          ['Twitter', '𝕏'],
          ['More', '⋯'],
        ].map(([l, ic]) => (
          <button key={l} style={{
            all:'unset', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap: 6, padding:'12px 0',
            borderRadius: 14, border:'1px solid var(--border)', background:'var(--card)',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 18, color:'var(--accent)', fontWeight: 500 }}>{ic}</div>
            <span style={{ fontSize: 11, color:'var(--fg-2)' }}>{l}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Privacy</p>
        <SettingRow label="Anyone with link" sub="Currently visible" toggle initial={true} />
      </div>
    </Shell>
  );
}

// ============================================================
// 10. PUBLIC PROFILE
// ============================================================
function PublicProfileScreen({ username = 'anna.l' } = {}) {
  const nav = useNav();
  const [following, setFollowing] = useStateA(false);
  return (
    <Shell title={`@${username}`} onBack={nav.pop}>
      <div className="card-hero fade-in" style={{ textAlign:'center', padding: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, black))', margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-fg)', fontSize: 32, fontWeight: 600 }}>A</div>
        <h1 className="display" style={{ fontSize: 24, lineHeight: 1.1 }}>Anna Lindqvist</h1>
        <p className="caption" style={{ fontSize: 12.5, marginTop: 2 }}>@{username} · Stockholm</p>
        <p style={{ fontSize: 13, color:'var(--fg-2)', marginTop: 10, maxWidth: 240, marginLeft:'auto', marginRight:'auto' }}>Editorial · earth tones · linen everything.</p>
        <div style={{ display:'flex', justifyContent:'center', gap: 24, marginTop: 16 }}>
          {[['38','outfits'],['184','followers'],['92','following']].map(([n, l]) => (
            <div key={l} style={{ textAlign:'center' }}>
              <p className="display" style={{ fontSize: 18, lineHeight: 1 }}>{n}</p>
              <p className="caption" style={{ fontSize: 10.5 }}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap: 8, marginTop: 16, justifyContent:'center' }}>
          <button className={`btn${following?' btn-outline':''}`} style={{ minWidth: 120 }} onClick={() => setFollowing(!following)}>
            {following ? 'Following' : 'Follow'}
          </button>
          <button className="btn btn-outline">Message</button>
        </div>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Outfits</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 6 }}>
          {[[32, 38, 200],[200, 32, 28],[18, 28, 200],[280, 28, 18],[120, 200, 32],[350, 32, 28]].map((hues, i) => (
            <button key={i} onClick={() => nav.push({ id:'outfit', props:{ name:'Outfit', kicker:`@${username}` } })} style={{
              all:'unset', cursor:'pointer', aspectRatio:'3/4', borderRadius: 10,
              background:`linear-gradient(135deg, hsl(${hues[0]} 32% 78%), hsl(${hues[1]} 26% 62%) 50%, hsl(${hues[2]} 30% 50%))`,
            }} className="fade-in" />
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// 11. BILLING SUCCESS / CANCEL
// ============================================================
function BillingSuccessScreen() {
  const nav = useNav();
  React.useEffect(() => {
    // Auto pop after a moment if desired — keep manual for now.
  }, []);
  return (
    <Shell title=" ">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 14, padding: '40px 20px', textAlign:'center' }}>
        <div style={{ width: 88, height: 88, borderRadius:'50%', background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 12 6 6 10-14" style={{ strokeDasharray: 60, animation:'draw-check 600ms ease-out forwards' }}/>
          </svg>
        </div>
        <h1 className="display" style={{ fontSize: 30, lineHeight: 1.1 }}>You're in.</h1>
        <p style={{ fontSize: 14, color:'var(--fg-2)', maxWidth: 280 }}>Welcome to Burs Premium. Unlimited outfits, full memory, travel capsules.</p>
        <div className="card" style={{ width:'100%', maxWidth: 320, padding: 14, marginTop: 8, textAlign:'left' }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Receipt</p>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize: 13.5 }}><span>Annual · Premium</span><span style={{ fontWeight: 500 }}>$59.00</span></div>
          <p className="caption" style={{ fontSize: 11, marginTop: 4 }}>Renews May 14, 2026</p>
        </div>
        <button className="btn btn-block" onClick={() => nav.replace('home')}>Continue</button>
      </div>
    </Shell>
  );
}

function BillingCancelScreen() {
  const nav = useNav();
  return (
    <Shell title=" ">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 14, padding: '40px 20px', textAlign:'center' }}>
        <div style={{ width: 80, height: 80, borderRadius:'50%', background:'var(--bg-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--fg-2)" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </div>
        <h1 className="page-title" style={{ fontSize: 26 }}>Checkout canceled</h1>
        <p style={{ fontSize: 13.5, color:'var(--fg-2)', maxWidth: 280 }}>No payment was taken. You can upgrade any time from Settings.</p>
        <button className="btn btn-block" onClick={() => nav.replace('paywall')}>Try again</button>
        <button className="btn-quiet" onClick={() => nav.replace('home')} style={{ background:'transparent', border:0, color:'var(--fg-2)', fontSize: 13, cursor:'pointer' }}>Back to home</button>
      </div>
    </Shell>
  );
}

// ============================================================
// 12. PICK MUST-HAVES — Travel Capsule sub-step
// ============================================================
function PickMustHavesScreen({ dest = 'Lisbon', days = 5 } = {}) {
  const nav = useNav();
  const [picked, setPicked] = useStateA(['linen-tee']);
  const items = [
    ['linen-tee', 'Linen tee', 'Tops', 32],
    ['white-oxford', 'White oxford', 'Tops', 200],
    ['cream-knit', 'Cream knit', 'Tops', 32],
    ['black-denim', 'Black denim', 'Bottoms', 28],
    ['linen-trouser', 'Linen trouser', 'Bottoms', 38],
    ['wool-overshirt', 'Wool overshirt', 'Outerwear', 38],
    ['sand-chore', 'Sand chore', 'Outerwear', 45],
    ['bone-sneaker', 'Bone sneaker', 'Shoes', 32],
    ['choc-loafer', 'Choc loafer', 'Shoes', 18],
    ['leather-belt', 'Brown belt', 'Accessories', 28],
  ];
  const toggle = (id) => setPicked(picked.includes(id) ? picked.filter(p => p !== id) : [...picked, id]);

  return (
    <Shell title="Travel Capsule" eyebrow="MUST-HAVES" onBack={nav.pop}>
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>Anything you must bring?</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)' }}>{dest} · {days} days. We'll build the capsule around these.</p>
      </div>
      <p style={{ fontSize: 12, color:'var(--fg-2)' }}>{picked.length} selected · max 6 recommended</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
        {items.map(([id, n, c, hue]) => (
          <button key={id} onClick={() => toggle(id)} style={{
            all:'unset', cursor:'pointer', borderRadius: 16, padding: 10,
            border: picked.includes(id) ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: picked.includes(id) ? 'var(--accent-soft)' : 'var(--card)',
            position:'relative',
          }}>
            <div style={{ aspectRatio:'4/5', borderRadius: 10, marginBottom: 8, background: `linear-gradient(135deg, hsl(${hue} 32% 78%), hsl(${(hue+30)%360} 26% 62%))` }} />
            <p style={{ fontSize: 13, fontWeight: 500 }}>{n}</p>
            <p className="caption" style={{ fontSize: 11 }}>{c}</p>
            {picked.includes(id) && (
              <div style={{ position:'absolute', top: 14, right: 14, width: 22, height: 22, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="3" strokeLinecap="round"><path d="m20 6-11 11-5-5"/></svg>
              </div>
            )}
          </button>
        ))}
      </div>
      <button className="btn btn-block" onClick={() => nav.push({ id:'travelPacking', props: { dest, days, mustHaves: picked.length }})}>Continue · build capsule</button>
      <button className="btn-quiet" onClick={() => nav.push({ id:'travelPacking', props: { dest, days, mustHaves: 0 }})} style={{ background:'transparent', border:0, color:'var(--fg-2)', fontSize: 13, cursor:'pointer', padding: '8px 0' }}>Skip · let stylist decide</button>
    </Shell>
  );
}

// ============================================================
// 13. PACKING LIST — final Travel Capsule page
// ============================================================
function TravelPackingScreen({ dest = 'Lisbon', days = 5 } = {}) {
  const nav = useNav();
  const [generating, setGenerating] = useStateA(true);
  const [groupBy, setGroupBy] = useStateA('category'); // 'category' | 'day'
  const [packed, setPacked] = useStateA(new Set());

  React.useEffect(() => {
    const t = setTimeout(() => setGenerating(false), 1100);
    return () => clearTimeout(t);
  }, []);

  const itemsByCategory = [
    ['Outerwear', [['Wool overshirt', 38], ['Sand chore', 45]]],
    ['Tops', [['Cream tee', 32], ['Linen henley', 38], ['Black tee', 28], ['Striped knit', 200], ['Oxford shirt', 220]]],
    ['Bottoms', [['Linen trouser', 38], ['Black denim', 28], ['Wool trouser', 220], ['Shorts', 32]]],
    ['Shoes', [['Bone sneaker', 32], ['Chocolate loafer', 18], ['Leather sandal', 38]]],
    ['Accessories', [['Brown leather belt', 28], ['Wool socks ×2', 220], ['Sunglasses', 28]]],
    ['Toiletries', [['Toothbrush + paste', 200], ['Razor', 220], ['Moisturizer', 32], ['Sunscreen', 45], ['Deodorant', 200]]],
    ['Tech', [['Phone charger', 220], ['Universal adapter', 220], ['Headphones', 28]]],
  ];

  const allItems = itemsByCategory.flatMap(([_, items]) => items);
  const total = allItems.length;
  const packedCount = packed.size;
  const pct = (packedCount / total) * 100;

  const toggle = (key) => {
    const next = new Set(packed);
    next.has(key) ? next.delete(key) : next.add(key);
    setPacked(next);
  };

  if (generating) {
    return (
      <Shell title="Capsule" eyebrow={`${dest.toUpperCase()} · ${days} DAYS`}>
        <div className="card-hero">
          <p className="eyebrow">Packing list</p>
          <Skeleton h={36} w="60%" style={{ marginTop: 6 }}/>
          <Skeleton h={14} w="80%" style={{ marginTop: 8 }}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 10, padding: '20px 0' }}>
          <Spinner size={28} />
          <p className="caption">Building your packing list…</p>
        </div>
        <Skeleton h={28} r={14} />
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display:'flex', gap: 10, alignItems:'center', padding:'8px 0' }}>
            <Skeleton w={22} h={22} r={6} />
            <Skeleton h={14} w={`${50 + Math.random()*30}%`} />
          </div>
        ))}
      </Shell>
    );
  }

  return (
    <Shell title="Packing list" eyebrow={`${dest.toUpperCase()} · ${days} DAYS`} onBack={nav.pop} action={{ label: 'Share', onClick: () => nav.push('shareOutfit') }}>
      {/* Hero */}
      <div className="card-hero fade-in">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 8 }}>
          <div>
            <p className="eyebrow">Packing progress</p>
            <h1 className="display" style={{ fontSize: 32, lineHeight: 1, marginTop: 4 }}>
              <span style={{ color:'var(--accent)' }}>{packedCount}</span>
              <span style={{ color:'var(--fg-3)' }}> / {total}</span>
            </h1>
            <p className="caption" style={{ fontSize: 11.5, marginTop: 4 }}>{packedCount === total ? 'All packed · ready to fly' : `${total - packedCount} pieces left`}</p>
          </div>
          {packedCount === total && (
            <div className="fade-in" style={{ width: 44, height: 44, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="3" strokeLinecap="round"><path d="m4 12 6 6 10-14"/></svg>
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, height: 6, borderRadius: 3, background:'var(--bg-2)', overflow:'hidden' }}>
          <div style={{ width: `${pct}%`, height:'100%', background:'var(--accent)', transition:'width 320ms ease' }} />
        </div>
      </div>

      {/* Last trip memory */}
      <button onClick={() => {}} style={{
        all:'unset', cursor:'pointer', display:'flex', alignItems:'center', gap: 12,
        padding:'12px 14px', borderRadius: 14, border:'1px dashed var(--border-2)', background:'transparent',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background:`linear-gradient(135deg, hsl(200 30% 75%), hsl(220 25% 60%))` }} />
        <div style={{ flex: 1 }}>
          <p className="eyebrow" style={{ fontSize: 9 }}>Last trip</p>
          <p style={{ fontSize: 13.5, fontWeight: 500 }}>Copenhagen · 4 days</p>
          <p className="caption" style={{ fontSize: 11 }}>Packed 14 of 14 · Mar 22</p>
        </div>
        <span className="caption" style={{ fontSize: 11.5, color:'var(--accent)' }}>Reuse →</span>
      </button>

      {/* Group toggle */}
      <div style={{ display:'flex', gap: 4, padding: 4, background:'var(--bg-2)', borderRadius: 999 }}>
        {[['category','By category'],['day','By day']].map(([id, l]) => (
          <button key={id} onClick={() => setGroupBy(id)} style={{
            all:'unset', cursor:'pointer', flex: 1, textAlign:'center', padding:'8px 0',
            borderRadius: 999, fontSize: 12.5, fontWeight: 500,
            background: groupBy===id?'var(--card)':'transparent',
            color: groupBy===id?'var(--fg)':'var(--fg-2)',
            boxShadow: groupBy===id?'var(--shadow-sm)':'none',
          }}>{l}</button>
        ))}
      </div>

      {/* List */}
      {groupBy === 'category' ? itemsByCategory.map(([cat, items], gi) => (
        <div key={cat} className="fade-in" style={{ animationDelay: `${gi*60}ms` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 6 }}>
            <p className="eyebrow">{cat} · {items.length}</p>
            <p className="caption" style={{ fontSize: 11 }}>{items.filter(([n]) => packed.has(`${cat}/${n}`)).length}/{items.length}</p>
          </div>
          <div className="card" style={{ padding: 4 }}>
            {items.map(([n, hue], i) => {
              const key = `${cat}/${n}`;
              const isOn = packed.has(key);
              return (
                <button key={n} onClick={() => toggle(key)} style={{
                  all:'unset', cursor:'pointer', display:'flex', alignItems:'center', gap: 12,
                  padding:'10px 12px', width:'100%', boxSizing:'border-box',
                  borderBottom: i<items.length-1?'1px solid var(--border)':'none',
                  opacity: isOn ? 0.55 : 1,
                  transition: 'opacity 200ms',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7,
                    border: isOn ? '2px solid var(--accent)' : '1.5px solid var(--border-2)',
                    background: isOn ? 'var(--accent)' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink: 0, transition: 'all 180ms',
                  }}>
                    {isOn && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5"/></svg>}
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background:`linear-gradient(135deg, hsl(${hue} 32% 78%), hsl(${(hue+30)%360} 26% 62%))`, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, textDecoration: isOn?'line-through':'none', color: isOn?'var(--fg-2)':'var(--fg)' }}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )) : (
        // by day
        [...Array(days)].map((_, di) => (
          <div key={di} className="fade-in" style={{ animationDelay: `${di*60}ms` }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Day {di+1}</p>
            <div className="card" style={{ padding: 4 }}>
              {allItems.slice(di*3, di*3+4).map(([n, hue], i, arr) => {
                const key = `D${di}/${n}`;
                const isOn = packed.has(key);
                return (
                  <button key={n} onClick={() => toggle(key)} style={{
                    all:'unset', cursor:'pointer', display:'flex', alignItems:'center', gap: 12,
                    padding:'10px 12px', width:'100%', boxSizing:'border-box',
                    borderBottom: i<arr.length-1?'1px solid var(--border)':'none',
                    opacity: isOn?0.55:1, transition:'opacity 200ms',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 7,
                      border: isOn ? '2px solid var(--accent)' : '1.5px solid var(--border-2)',
                      background: isOn ? 'var(--accent)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0, transition:'all 180ms',
                    }}>
                      {isOn && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5"/></svg>}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background:`linear-gradient(135deg, hsl(${hue} 32% 78%), hsl(${(hue+30)%360} 26% 62%))`, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, textDecoration: isOn?'line-through':'none', color: isOn?'var(--fg-2)':'var(--fg)' }}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPacked(new Set())}>Reset</button>
        <button className="btn" style={{ flex: 2 }} onClick={() => nav.replace('home')}>Save trip</button>
      </div>
    </Shell>
  );
}

// ============================================================
// 14. STYLE CHAT — upgraded with history drawer + memory
// ============================================================
function StyleChatV2Screen() {
  const nav = useNav();
  const [msg, setMsg] = useStateA('');
  const [drawer, setDrawer] = useStateA(null); // null | 'history' | 'memory'
  const [thinking, setThinking] = useStateA(false);
  const [activeChat, setActiveChat] = useStateA(0);

  const sessions = [
    { title: 'Coffee meeting · linen', when: 'Today', preview: 'Cream wool tee, navy cardigan if it stays under 16°…' },
    { title: 'Wedding outfit thoughts', when: 'Yesterday', preview: 'Olive linen suit, white tee, brown loafer.' },
    { title: 'What to wear in Lisbon', when: 'Mar 22', preview: 'Lean breathable. Linen trouser, ecru tee…' },
    { title: 'Job interview · soft authority', when: 'Mar 14', preview: 'Charcoal trouser, knit polo, leather loafer.' },
    { title: 'Friday gallery night', when: 'Mar 8', preview: 'Black tee, wide trouser, statement loafer.' },
    { title: 'Workout fits', when: 'Feb 28', preview: 'Sweat-friendly. Don\'t skip the merino socks.' },
  ];

  const memory = {
    facts: [
      ['Style', 'Editorial · earth tones · linen-leaning'],
      ['Sizes', 'Top M · Bottom 32 · Shoe 10'],
      ['Climate', 'Stockholm · 4-22°'],
      ['Avoids', 'Pure synthetic, neon, slim cuts'],
      ['Loves', 'Wool overshirt · bone sneaker · cream knit'],
      ['Body', 'Long torso · prefers higher rise'],
    ],
    recentGoals: [
      'Travel-friendly capsules under 14 pieces',
      'More mid-formal options for weekday meetings',
      'Reduce idle pieces (currently 14)',
    ],
  };

  const send = () => {
    if (!msg.trim()) return;
    setThinking(true);
    setTimeout(() => setThinking(false), 1500);
    setMsg('');
  };

  return (
    <div className={`device theme-${nav.theme}`} style={{ position:'relative' }}>
      <StatusBar />
      <div className="screen-nav" style={{ borderBottom:'1px solid var(--border)' }}>
        <button className="screen-back" onClick={() => setDrawer('history')} aria-label="History">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <div style={{ flex: 1, textAlign:'center' }}>
          <p className="eyebrow" style={{ fontSize: 9, marginBottom: 1 }}>AI Stylist</p>
          <div style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontWeight: 500, fontSize: 18, color:'var(--fg)' }}>{sessions[activeChat]?.title || 'Style Chat'}</div>
        </div>
        <button className="screen-action" onClick={() => setDrawer('memory')} aria-label="Memory">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 0-4 4v3M12 2a4 4 0 0 1 4 4v3M8 9h8M8 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3"/><circle cx="12" cy="14" r="2"/></svg>
        </button>
      </div>

      <div className="screen-body" style={{ bottom: 78 }}>
        <div className="screen-body-inner" style={{ gap: 10 }}>
          <p className="caption" style={{ textAlign:'center', padding:'4px 0 6px' }}>Today, 09:14</p>

          {/* Memory pill — what I remember about this convo */}
          <div onClick={() => setDrawer('memory')} style={{
            cursor:'pointer', alignSelf:'center',
            display:'inline-flex', alignItems:'center', gap: 6,
            padding:'5px 12px', borderRadius: 999,
            background:'var(--accent-soft)', color:'var(--accent)', fontSize: 11, fontWeight: 500,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a4 4 0 0 0-4 4v3M12 2a4 4 0 0 1 4 4v3M8 9h8"/></svg>
            Stylist remembers your fits & climate
          </div>

          <div className="bubble out">What goes with my linen trousers for a coffee meeting?</div>
          <div className="bubble in">Cream wool tee, navy cardigan if it stays under 16°. Lean to your bone sneakers — bone tones the linen up.</div>
          <div style={{ alignSelf:'flex-start', width:'78%' }}>
            <window.OutfitCard
              name="Coffee · soft tailored"
              sub="4 PIECES · 14° CLOUDY"
              hues={[32, 38, 200, 28]}
              onUse={() => nav.push({ id:'outfit', props:{ name: 'Coffee meeting', kicker: 'STYLIST' }})}
              onSave={() => {}}
            />
          </div>
          <div className="bubble out">Add a jacket?</div>
          <div className="bubble in">Sand canvas chore over the cardigan. Keeps you sharp without overheating.</div>
          <div style={{ alignSelf:'flex-start', width:'78%' }}>
            <window.OutfitCard
              name="Coffee · with chore"
              sub="5 PIECES · LAYERED"
              hues={[45, 32, 38, 28]}
              onUse={() => nav.push({ id:'outfit', props:{ name: 'Coffee + chore', kicker: 'STYLIST' }})}
              onSave={() => {}}
            />
          </div>

          {thinking && (
            <div className="fade-in" style={{ alignSelf:'flex-start', display:'flex', gap: 4, padding:'10px 14px', background:'var(--card)', border:'1px solid var(--border)', borderRadius: '18px 18px 18px 4px', maxWidth: 80 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius:'50%', background:'var(--fg-3)', animation:`pulse-soft 1.2s ${i*0.18}s ease-in-out infinite` }}/>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="composer">
        <textarea className="composer-input" placeholder="Ask the stylist…" value={msg} onChange={(e) => setMsg(e.target.value)} rows={1} onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="composer-send" disabled={!msg.trim()} onClick={send}><Icon.Chevron /></button>
      </div>
      <div className="home-indicator" />

      {/* History drawer */}
      {drawer && (
        <div onClick={() => setDrawer(null)} style={{
          position:'absolute', inset: 0, background:'rgba(0,0,0,0.4)',
          zIndex: 50, animation:'float-up 200ms ease',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            position:'absolute', top: 0, bottom: 0,
            [drawer === 'history' ? 'left' : 'right']: 0,
            width: '82%', background:'var(--bg)',
            display:'flex', flexDirection:'column',
            animation: `slide-${drawer === 'history' ? 'in-left' : 'in-right'} 280ms cubic-bezier(0.32, 0.72, 0, 1)`,
            boxShadow: drawer === 'history' ? '4px 0 30px rgba(0,0,0,0.2)' : '-4px 0 30px rgba(0,0,0,0.2)',
          }}>
            <div style={{ padding:'56px 18px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 2 }}>{drawer === 'history' ? 'Past sessions' : 'About you'}</p>
                <h2 style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 22, fontWeight: 500 }}>{drawer === 'history' ? 'History' : 'Memory'}</h2>
              </div>
              <button onClick={() => setDrawer(null)} className="icon-btn ghost" style={{ width: 36, height: 36 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY:'auto', padding: '14px 18px' }}>
              {drawer === 'history' ? (
                <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
                  <button className="btn" onClick={() => { setActiveChat(-1); setDrawer(null); }} style={{ marginBottom: 12 }}>
                    + New chat
                  </button>
                  {sessions.map((s, i) => (
                    <button key={i} onClick={() => { setActiveChat(i); setDrawer(null); }} style={{
                      all:'unset', cursor:'pointer', padding:'12px 12px', borderRadius: 12,
                      background: activeChat===i?'var(--accent-soft)':'transparent',
                      borderLeft: activeChat===i?'2px solid var(--accent)':'2px solid transparent',
                      display:'flex', flexDirection:'column', gap: 2,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                        <p style={{ fontSize: 13.5, fontWeight: 500, color:'var(--fg)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'70%' }}>{s.title}</p>
                        <p className="caption" style={{ fontSize: 10.5, flexShrink: 0 }}>{s.when}</p>
                      </div>
                      <p className="caption" style={{ fontSize: 11.5, color:'var(--fg-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.preview}</p>
                    </button>
                  ))}
                </div>
              ) : (
                // Memory panel
                <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
                  <div className="card-hero" style={{ padding: 14 }}>
                    <p className="eyebrow">Stylist memory</p>
                    <p style={{ fontSize: 13, color:'var(--fg-2)', marginTop: 4, lineHeight: 1.5 }}>What I've learned about your style. You can edit or remove anything.</p>
                  </div>

                  <div>
                    <p className="eyebrow" style={{ marginBottom: 8 }}>Facts</p>
                    <div className="card" style={{ padding: 4 }}>
                      {memory.facts.map(([k, v], i) => (
                        <div key={k} style={{ display:'flex', alignItems:'center', gap: 10, padding:'11px 12px', borderBottom: i<memory.facts.length-1?'1px solid var(--border)':'none' }}>
                          <div style={{ flex: 1 }}>
                            <p className="caption" style={{ fontSize: 10 }}>{k}</p>
                            <p style={{ fontSize: 13, color:'var(--fg)' }}>{v}</p>
                          </div>
                          <button className="btn-quiet" style={{ background:'transparent', border:0, color:'var(--accent)', fontSize: 12, fontWeight: 500, cursor:'pointer' }}>Edit</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="eyebrow" style={{ marginBottom: 8 }}>Recent goals</p>
                    <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
                      {memory.recentGoals.map((g, i) => (
                        <div key={i} className="card" style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius:3, background:'var(--accent)', flexShrink: 0 }}/>
                          <p style={{ fontSize: 13, color:'var(--fg)', flex: 1 }}>{g}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button className="btn btn-outline btn-block">Add a fact</button>
                  <button className="btn-quiet" style={{ background:'transparent', border:0, color:'#c44', fontSize: 13, fontWeight: 500, cursor:'pointer', padding:'10px 0' }}>
                    Reset all memory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
@keyframes slide-in-left { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes slide-in-right { from { transform: translateX(100%) } to { transform: translateX(0) } }
`}</style>
    </div>
  );
}

// ============================================================
// 15. PRIVACY POLICY / TERMS / 404 are simple text — covered above.
// ============================================================
function LegalScreen({ kind = 'privacy' } = {}) {
  const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const body = kind === 'privacy'
    ? `We collect what's needed to style you — your wardrobe photos, sizes, climate, and preferences. We never sell your data. You can delete everything any time.`
    : `Use Burs to style yourself, share looks, and plan trips. Don't impersonate others. We can update terms with notice. Premium auto-renews until you cancel.`;
  return (
    <Shell title={title} eyebrow="LEGAL">
      <div className="card" style={{ padding: 20, lineHeight: 1.7, fontSize: 14, color:'var(--fg-2)' }}>
        <p style={{ marginBottom: 14 }}>{body}</p>
        <p style={{ marginBottom: 14 }}>This is a placeholder summary. Full policy at burs.app/{kind}.</p>
        <p>Last updated · April 2026</p>
      </div>
    </Shell>
  );
}

// ============================================================
// EXPORT
// ============================================================
Object.assign(window, {
  // Loading helpers
  Skeleton, Spinner, LoadingOverlay,
  // Screens
  InsightsFullScreen,
  MoodFlowScreen,
  EditGarmentScreen,
  UnusedOutfitsScreen,
  UsedGarmentsScreen,
  SettingsAppearanceScreen,
  SettingsStyleScreen,
  SettingsNotificationsScreen,
  SettingsAccountScreen,
  SettingsPrivacyScreen,
  ResetPasswordScreen,
  NotFoundScreen,
  ShareOutfitScreen,
  PublicProfileScreen,
  BillingSuccessScreen,
  BillingCancelScreen,
  PickMustHavesScreen,
  TravelPackingScreen,
  StyleChatV2Screen,
  LegalScreen,
});

/* All secondary screens for the clickable prototype.
   Components depend on globals: React, Icon, StatusBar, Thumb, BottomNav, useNav.
*/

const { useNav } = window;

// =================== SCREEN SHELL ===================
function ScreenShell({ title, eyebrow, onBack, action, withTabBar, children, theme }) {
  const nav = useNav();
  const goBack = onBack || nav.pop;
  const isRoot = nav.stack && nav.stack.length === 1;
  return (
    <div className={`device theme-${theme || nav.theme}`}>
      <StatusBar />
      <div className="screen-nav" style={{ borderBottom: '1px solid var(--border)' }}>
        {isRoot ? <div style={{ width: 60 }} /> : <button className="screen-back" onClick={goBack} aria-label="Back"><Icon.Back /> Back</button>}
        <div style={{ flex: 1, textAlign: 'center' }}>
          {eyebrow ? <p className="eyebrow" style={{ fontSize: 9, marginBottom: 1 }}>{eyebrow}</p> : null}
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 18, letterSpacing: '-0.01em', color: 'var(--fg)' }}>{title}</div>
        </div>
        {action ? <button className="screen-action" onClick={action.onClick}>{action.label}</button> : <div style={{ width: 60 }} />}
      </div>
      <div className={`screen-body${withTabBar ? ' with-nav' : ''}`}>
        <div className="screen-body-inner">{children}</div>
      </div>
      {withTabBar && <BottomNav active={withTabBar} />}
      <div className="home-indicator" />
    </div>
  );
}

// Color helper for thumb tiles
const hueGrad = (h) => `linear-gradient(135deg, hsl(${h} 38% 78%), hsl(${(h+30)%360} 30% 62%))`;

// =================== OUTFIT CARD (reusable) ===================
function OutfitCard({ name, sub, hues = [32, 28, 200, 18], onUse, onSave }) {
  return (
    <div className="outfit-card">
      <div className="oc-grid">
        {hues.map((h, i) => <div key={i} className="oc-tile" style={{ background: hueGrad(h) }} />)}
      </div>
      <div className="oc-meta">
        <span className="oc-sub">{sub}</span>
        <span className="oc-name">{name}</span>
      </div>
      {(onUse || onSave) && (
        <div className="oc-actions">
          {onUse ? <button className="btn btn-sm" style={{ flex: 1 }} onClick={onUse}>Wear this</button> : null}
          {onSave ? <button className="btn btn-outline btn-sm" onClick={onSave}>Save</button> : null}
        </div>
      )}
    </div>
  );
}

// =================== OUTFIT DETAIL ===================
function OutfitDetailScreen({ name = "Studio brunch", kicker = "TODAY'S LOOK" }) {
  const nav = useNav();
  return (
    <ScreenShell title="Outfit" action={{ label: 'Save', onClick: () => {} }}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>{kicker}</p>
        <h1 className="page-title">{name}</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)', marginTop: 6, lineHeight: 1.5 }}>
          Wool overshirt over cream linen. Built for 14° clear weather, gallery opening at 11.
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6 }}>
        {[32, 28, 200, 18].map((h, i) => (
          <div key={i} style={{ aspectRatio: 1, borderRadius: 14, background: hueGrad(h), border:'1px solid var(--border)' }} />
        ))}
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Pieces</p>
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {[
            ['Wool overshirt', 'Beige · M', 32],
            ['Cream linen trouser', '32 · Long', 38],
            ['Bone leather sneaker', 'Size 43', 28],
            ['Gold-frame sunglasses', 'Tortoise', 45],
          ].map(([t, s, h], idx) => (
            <button key={idx} className="list-row" onClick={() => nav.push({ id: 'garment', props: { name: t, sub: s }})}>
              <div className="lr-thumb" style={{ background: hueGrad(h) }} />
              <div className="lr-meta">
                <span className="lr-title">{t}</span>
                <span className="lr-sub">{s}</span>
              </div>
              <span className="lr-trail"><Icon.Chevron /></span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn btn-block" style={{ flex: 1 }}>Wear today</button>
        <button className="btn btn-outline">Restyle</button>
      </div>
    </ScreenShell>
  );
}

// =================== STYLE CHAT — with outfit cards ===================
function StyleChatScreen() {
  const nav = useNav();
  const [msg, setMsg] = React.useState('');
  return (
    <div className={`device theme-${nav.theme}`}>
      <StatusBar />
      <div className="screen-nav" style={{ borderBottom: '1px solid var(--border)' }}>
        <button className="screen-back" onClick={nav.pop}><Icon.Back /> Back</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p className="eyebrow" style={{ fontSize: 9, marginBottom: 1 }}>AI Stylist</p>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 18, letterSpacing: '-0.01em', color: 'var(--fg)' }}>Style Chat</div>
        </div>
        <button className="screen-action" aria-label="New chat"><Icon.Plus /></button>
      </div>
      <div className="screen-body" style={{ bottom: 78 }}>
        <div className="screen-body-inner" style={{ gap: 10 }}>
          <p className="caption" style={{ textAlign:'center', padding:'4px 0 6px' }}>Today, 09:14</p>
          <div className="bubble out">What goes with my linen trousers for a coffee meeting?</div>
          <div className="bubble in">Cream wool tee, navy cardigan if it stays under 16°. Lean to your bone sneakers — bone tones the linen up.</div>
          {/* Outfit card inline */}
          <div style={{ alignSelf:'flex-start', width:'78%' }}>
            <OutfitCard
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
            <OutfitCard
              name="Coffee · with chore"
              sub="5 PIECES · LAYERED"
              hues={[45, 32, 38, 28]}
              onUse={() => nav.push({ id:'outfit', props:{ name: 'Coffee + chore', kicker: 'STYLIST' }})}
              onSave={() => {}}
            />
          </div>
        </div>
      </div>
      <div className="composer">
        <textarea className="composer-input" placeholder="Ask the stylist…" value={msg} onChange={(e) => setMsg(e.target.value)} rows={1} />
        <button className="composer-send" disabled={!msg.trim()}><Icon.Chevron /></button>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== OUTFITS LIST ===================
function OutfitsScreen() {
  const nav = useNav();
  const [tab, setTab] = React.useState('all');
  const outfits = [
    ['Studio brunch', '4 pieces · worn 12d ago', [32, 38, 200, 28]],
    ['Sunday casual', '3 pieces · worn 4d ago', [200, 220, 28, 45]],
    ['Boardroom', '5 pieces · worn 21d ago', [220, 28, 200, 18]],
    ['Gallery night', '4 pieces · worn 6d ago', [280, 28, 18, 200]],
    ['Weekend run', '3 pieces · never worn', [120, 200, 32, 45]],
    ['Date — soft', '4 pieces · worn 30d ago', [350, 32, 28, 18]],
  ];
  return (
    <ScreenShell title="Outfits" action={{ label: '+ New', onClick: () => nav.push('styleme') }}>
      <div className="chip-row">
        {[['all','All · 38'],['favs','Favorites'],['recent','Recent'],['unworn','Unworn']].map(([id, l]) => (
          <button key={id} className={`chip-pill${tab===id?' active':''}`} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
        {outfits.map(([name, sub, hues], i) => (
          <button key={i} onClick={() => nav.push({ id: 'outfit', props: { name, kicker: 'OUTFIT' }})} style={{ all:'unset', cursor:'pointer' }}>
            <OutfitCard name={name} sub={sub} hues={hues} />
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

// =================== STYLE ME — criteria-based outfit creator ===================
function StyleMeScreen() {
  const nav = useNav();
  const [view, setView] = React.useState('criteria'); // 'criteria' | 'generating' | 'results'

  // Criteria
  const [occ, setOcc] = React.useState('Coffee meeting');
  const [mood, setMood] = React.useState('Calm');
  const [weather, setWeather] = React.useState('As today');
  const [formality, setFormality] = React.useState(2); // 0..4 — Casual to Formal
  const [palette, setPalette] = React.useState('Neutral');
  const [layers, setLayers] = React.useState(true);
  const [mustInclude, setMustInclude] = React.useState([]);
  const [avoid, setAvoid] = React.useState([]);

  const occasions = ['Coffee meeting','Date night','Boardroom','Gallery','Travel','Workout','Wedding','Dinner','Beach day','Client pitch','Brunch','Concert','Job interview','Weekend errand'];
  const moods = ['Calm','Sharp','Cool','Bold','Soft','Bright','Moody','Tender','Grounded','Polished','Easy','Rich'];
  const weathers = ['As today · 14° cloudy','Warmer','Cooler','Rain'];
  const palettes = ['Neutral','Earth','Cool','Bold','Pastel','Mono'];
  const formalityLabels = ['Loungewear','Casual','Smart casual','Business','Formal'];
  const includeOptions = ['Wool overshirt','White oxford','Camel loafer','Charcoal trouser','Cashmere knit','Linen tee'];
  const avoidOptions  = ['Denim','White','Black','Leather','Heels','Synthetic'];

  const togglePick = (val, list, setList) =>
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);

  // Outfit hue palettes per chosen "palette"
  const huesByPalette = {
    Neutral: [[32, 28, 200, 18], [38, 28, 200, 32], [220, 32, 28, 18]],
    Earth:   [[32, 18, 38, 28], [45, 32, 18, 28], [38, 18, 75, 28]],
    Cool:    [[200, 220, 28, 32], [220, 200, 32, 18], [200, 18, 220, 28]],
    Bold:    [[280, 28, 18, 200], [350, 18, 32, 28], [120, 32, 28, 18]],
    Pastel:  [[200, 32, 38, 18], [350, 32, 200, 28], [120, 32, 200, 18]],
    Mono:    [[28, 28, 28, 28], [220, 220, 220, 220], [18, 18, 18, 18]],
  };
  const hues = huesByPalette[palette];

  const generate = () => {
    setView('generating');
    setTimeout(() => setView('results'), 1100);
  };

  // Result outfit alternatives
  const alternatives = [
    { name: occ + ' · take 1', sub: `${mood.toUpperCase()} · ${formalityLabels[formality].toUpperCase()}`, hues: hues[0] },
    { name: occ + ' · take 2', sub: `${mood.toUpperCase()} · ${palette.toUpperCase()}`, hues: hues[1] },
    { name: occ + ' · take 3', sub: `${weather.split(' ')[0].toUpperCase()} · ${palette.toUpperCase()}`, hues: hues[2] },
  ];

  // ----------- generating view -----------
  if (view === 'generating') {
    return (
      <ScreenShell title="Style Me" eyebrow="GENERATING">
        <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 16px', gap: 18, textAlign:'center' }}>
          <div style={{ position:'relative', width: 64, height: 64 }}>
            <div style={{ position:'absolute', inset: 0, borderRadius: 999, border:'2px solid var(--border)' }} />
            <div style={{ position:'absolute', inset: 0, borderRadius: 999, border:'2px solid var(--accent)', borderTopColor:'transparent', animation:'spin 1.1s linear infinite' }} />
          </div>
          <p className="eyebrow">STYLING FROM YOUR WARDROBE</p>
          <h2 className="display" style={{ fontSize: 24, lineHeight: 1.1 }}>Pulling 3 takes for {occ.toLowerCase()}</h2>
          <p style={{ fontSize: 12.5, color:'var(--fg-2)', maxWidth: 240, lineHeight: 1.5 }}>{mood} · {formalityLabels[formality]} · {palette} palette · {weather.split('·')[0].trim()}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </ScreenShell>
    );
  }

  // ----------- results view -----------
  if (view === 'results') {
    return (
      <ScreenShell title="Style Me" eyebrow="3 TAKES" action={{ label: 'Edit', onClick: () => setView('criteria') }}>
        <div className="card-hero">
          <p className="eyebrow" style={{ marginBottom: 6 }}>Brief</p>
          <p style={{ fontSize: 13, color:'var(--fg)', lineHeight: 1.45 }}>
            <strong style={{ color:'var(--fg)' }}>{occ}</strong> · {mood.toLowerCase()} · {formalityLabels[formality].toLowerCase()} · {palette.toLowerCase()} palette · {weather.split('·')[0].trim().toLowerCase()}
            {mustInclude.length > 0 && <> · must include {mustInclude.join(', ').toLowerCase()}</>}
            {avoid.length > 0 && <> · avoid {avoid.join(', ').toLowerCase()}</>}
          </p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          {alternatives.map((alt, i) => (
            <div key={i} style={{ position:'relative' }}>
              <div style={{ position:'absolute', top: 8, left: 10, fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 22, color:'var(--accent)', zIndex: 2, textShadow:'0 1px 12px rgba(0,0,0,.25)' }}>{i + 1}</div>
              <OutfitCard
                name={alt.name}
                sub={alt.sub}
                hues={alt.hues}
                onUse={() => nav.push({ id:'outfit', props:{ name: alt.name, kicker: 'STYLE ME · ' + (i+1) }})}
                onSave={() => {}}
              />
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={generate}>Regenerate</button>
          <button className="btn" style={{ flex: 1 }} onClick={() => setView('criteria')}>Tweak criteria</button>
        </div>
      </ScreenShell>
    );
  }

  // ----------- criteria view -----------
  return (
    <ScreenShell title="Style Me" eyebrow="OUTFIT CREATOR">
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>Set the criteria</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>We’ll style three outfits from your wardrobe to match.</p>
      </div>

      {/* Occasion */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Occasion</p>
        <div className="chip-row">
          {occasions.map(o => (
            <button key={o} className={`chip-pill${occ===o?' active':''}`} onClick={() => setOcc(o)}>{o}</button>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Mood</p>
        <div className="chip-row">
          {moods.map(m => (
            <button key={m} className={`chip-pill${mood===m?' active':''}`} onClick={() => setMood(m)}>{m}</button>
          ))}
        </div>
      </div>

      {/* Formality slider */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 8 }}>
          <p className="eyebrow">Formality</p>
          <span className="caption" style={{ color:'var(--accent)' }}>{formalityLabels[formality]}</span>
        </div>
        <div style={{ display:'flex', gap: 4 }}>
          {[0,1,2,3,4].map(i => (
            <button key={i}
              onClick={() => setFormality(i)}
              style={{
                flex: 1, height: 38, borderRadius: 10,
                border: i === formality ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: i <= formality ? 'var(--accent-soft)' : 'var(--card)',
                color: i === formality ? 'var(--accent)' : 'var(--fg-2)',
                fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
                cursor:'pointer',
              }}>{i+1}</button>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop: 4 }}>
          <span className="caption" style={{ opacity: 0.6 }}>Casual</span>
          <span className="caption" style={{ opacity: 0.6 }}>Formal</span>
        </div>
      </div>

      {/* Weather */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Weather</p>
        <div className="chip-row">
          {weathers.map(w => (
            <button key={w} className={`chip-pill${weather===w?' active':''}`} onClick={() => setWeather(w)}>{w}</button>
          ))}
        </div>
      </div>

      {/* Palette */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Color palette</p>
        <div className="chip-row">
          {palettes.map(p => (
            <button key={p} className={`chip-pill${palette===p?' active':''}`} onClick={() => setPalette(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Layers toggle */}
      <div className="settings-group">
        <div className="settings-row" style={{ cursor:'default' }}>
          <span className="sr-icon"><Icon.Hanger /></span>
          <span className="sr-label">Include outerwear / layers</span>
          <button className={`toggle-pill${layers ? ' on' : ''}`} onClick={() => setLayers(!layers)} />
        </div>
      </div>

      {/* Must include */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Must include · optional</p>
        <div className="chip-row">
          {includeOptions.map(p => (
            <button key={p} className={`chip-pill${mustInclude.includes(p) ? ' active' : ''}`} onClick={() => togglePick(p, mustInclude, setMustInclude)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Avoid */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Avoid · optional</p>
        <div className="chip-row">
          {avoidOptions.map(p => (
            <button key={p} className={`chip-pill${avoid.includes(p) ? ' active' : ''}`} onClick={() => togglePick(p, avoid, setAvoid)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <button className="btn btn-block" onClick={generate} style={{ marginTop: 4 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap: 8 }}><Icon.Sparkles /> Generate 3 outfits</span>
      </button>
    </ScreenShell>
  );
}

// =================== MOOD OUTFIT — 12 moods ===================
// Pure-SVG glyphs — no emojis. Each one is a quiet editorial mark in gold.
const MoodGlyph = ({ name }) => {
  const s = { width: 28, height: 28, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'Calm': // three soft horizontal layers
      return (<svg viewBox="0 0 24 24" {...s}><path d="M4 8c2-1 4-1 6 0s4 1 6 0 4-1 4-1"/><path d="M4 13c2-1 4-1 6 0s4 1 6 0 4-1 4-1"/><path d="M4 18c2-1 4-1 6 0s4 1 6 0 4-1 4-1"/></svg>);
    case 'Sharp': // angular bolt
      return (<svg viewBox="0 0 24 24" {...s}><path d="M14 3 6 13h5l-2 8 9-11h-5l1-7z"/></svg>);
    case 'Cool': // double wave
      return (<svg viewBox="0 0 24 24" {...s}><path d="M3 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>);
    case 'Bold': // filled circle inside ring
      return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>);
    case 'Soft': // crescent moon
      return (<svg viewBox="0 0 24 24" {...s}><path d="M19 14A8 8 0 1 1 10 5a6 6 0 0 0 9 9z"/></svg>);
    case 'Bright': // sun + rays
      return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>);
    case 'Moody': // filled diamond
      return (<svg viewBox="0 0 24 24" {...s}><path d="M12 3 21 12 12 21 3 12z" fill="currentColor"/></svg>);
    case 'Tender': // four-petal flower
      return (<svg viewBox="0 0 24 24" {...s}><path d="M12 4c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4z"/><path d="M12 12c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4z"/><path d="M4 12c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z"/><path d="M12 12c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z"/></svg>);
    case 'Grounded': // mountain
      return (<svg viewBox="0 0 24 24" {...s}><path d="M3 19h18L15 8l-3 5-2-3-7 9z"/></svg>);
    case 'Polished': // sparkle / four-point star
      return (<svg viewBox="0 0 24 24" {...s}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M12 3c0 5 4 9 9 9-5 0-9 4-9 9 0-5-4-9-9-9 5 0 9-4 9-9z" fill="currentColor" opacity=".15"/></svg>);
    case 'Easy': // single soft wheat-stem curve
      return (<svg viewBox="0 0 24 24" {...s}><path d="M12 21V8"/><path d="M12 12c-3-1-5-3-5-6 3 0 5 2 5 5"/><path d="M12 14c3-1 5-3 5-6-3 0-5 2-5 5"/></svg>);
    case 'Rich': // wine glass
      return (<svg viewBox="0 0 24 24" {...s}><path d="M7 4h10c0 5-2 8-5 8s-5-3-5-8z"/><path d="M12 12v7M9 19h6"/></svg>);
    default:
      return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="6"/></svg>);
  }
};

function MoodOutfitScreen() {
  const nav = useNav();
  const moods = [
    ['Calm',     'Soft layers'],
    ['Sharp',    'Tailored, decisive'],
    ['Cool',     'Confident, easy'],
    ['Bold',     'Statement, color'],
    ['Soft',     'Rounded, low-stim'],
    ['Bright',   'Open, warm'],
    ['Moody',    'Dark, considered'],
    ['Tender',   'Romantic, light'],
    ['Grounded', 'Earthy, sturdy'],
    ['Polished', 'Refined, clean'],
    ['Easy',     'Off-duty, relaxed'],
    ['Rich',     'Saturated, deep'],
  ];
  return (
    <ScreenShell title="Mood Outfit" eyebrow="DRESS HOW YOU FEEL">
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>How are you feeling?</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>Pick a mood. We’ll style your day from your wardrobe.</p>
      </div>
      <div className="mood-grid">
        {moods.map(([name, sub], i) => (
          <button key={i} className="mood-card" onClick={() => nav.push({ id:'outfit', props:{ name, kicker:'MOOD' }})}>
            <div className="mood-glyph"><MoodGlyph name={name} /></div>
            <div>
              <div className="mood-label">{name}</div>
              <div className="mood-sub">{sub}</div>
            </div>
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

// =================== TRAVEL CAPSULE — multi-page wizard ===================
function TravelCapsuleScreen() {
  const nav = useNav();
  const [step, setStep] = React.useState(0); // 0 destination, 1 dates, 2 trip type, 3 weather, 4 capsule
  const [dest, setDest] = React.useState('Lisbon');
  const [days, setDays] = React.useState(5);
  const [trip, setTrip] = React.useState('Mixed');
  const [weather, setWeather] = React.useState('Mild · 18-24°');

  const StepDots = () => (
    <div className="steps-bar">
      {[0,1,2,3,4].map(i => (
        <div key={i} className={`step-dot${i < step ? ' done' : i === step ? ' now' : ''}`} />
      ))}
    </div>
  );

  const back = () => step === 0 ? nav.pop() : setStep(s => s - 1);

  if (step === 0) return (
    <ScreenShell title="Travel Capsule" eyebrow="STEP 1 OF 5" onBack={back}>
      <StepDots />
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>Where to?</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)' }}>Tell us your destination.</p>
      </div>
      <input className="composer-input" placeholder="e.g. Lisbon" value={dest} onChange={e => setDest(e.target.value)} style={{ borderRadius: 14, padding: 14 }} />
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Recent</p>
        <div className="chip-row">
          {['Lisbon','Tokyo','New York','Copenhagen','Marrakesh'].map(c => (
            <button key={c} className={`chip-pill${dest===c?' active':''}`} onClick={() => setDest(c)}>{c}</button>
          ))}
        </div>
      </div>
      <button className="btn btn-block" disabled={!dest.trim()} onClick={() => setStep(1)}>Next</button>
    </ScreenShell>
  );

  if (step === 1) return (
    <ScreenShell title="Travel Capsule" eyebrow="STEP 2 OF 5" onBack={back}>
      <StepDots />
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>How long?</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)' }}>{dest} · pick your trip length.</p>
      </div>
      <div style={{ padding: 18, background:'var(--card)', border:'1px solid var(--border)', borderRadius: 16, display:'flex', flexDirection:'column', gap: 14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <span className="eyebrow">Duration</span>
          <span className="display" style={{ fontSize: 28, color:'var(--accent)' }}>{days} <span style={{ fontSize: 13, color:'var(--fg-2)', fontStyle:'normal' }}>days</span></span>
        </div>
        <input type="range" min={2} max={21} value={days} onChange={e => setDays(+e.target.value)} style={{ width:'100%', accentColor:'var(--accent)' }} />
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span className="caption">2d</span><span className="caption">21d</span>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
        <input className="composer-input" placeholder="From — May 12" style={{ borderRadius: 14, padding: 14 }} />
        <input className="composer-input" placeholder="To — May 17" style={{ borderRadius: 14, padding: 14 }} />
      </div>
      <button className="btn btn-block" onClick={() => setStep(2)}>Next</button>
    </ScreenShell>
  );

  if (step === 2) return (
    <ScreenShell title="Travel Capsule" eyebrow="STEP 3 OF 5" onBack={back}>
      <StepDots />
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>Trip type</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)' }}>Shapes what we pack.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
        {[
          ['Business','Suits, polished'],
          ['Leisure','Easy, relaxed'],
          ['Mixed','A little of both'],
          ['Active','Sport, performance'],
          ['Beach','Sun, swim, light'],
          ['Special event','Wedding, gala'],
        ].map(([t, s]) => (
          <button key={t} onClick={() => setTrip(t)} style={{
            padding: 16, borderRadius: 16,
            border: trip === t ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: trip === t ? 'var(--accent-soft)' : 'var(--card)',
            cursor:'pointer', textAlign:'left', fontFamily:'inherit', color:'var(--fg)',
            display:'flex', flexDirection:'column', gap: 4,
          }}>
            <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 18, fontWeight: 500 }}>{t}</span>
            <span className="caption">{s}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-block" onClick={() => setStep(3)}>Next</button>
    </ScreenShell>
  );

  if (step === 3) return (
    <ScreenShell title="Travel Capsule" eyebrow="STEP 4 OF 5" onBack={back}>
      <StepDots />
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>Weather</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)' }}>Pulled from {dest}, {days}-day forecast.</p>
      </div>
      <div className="capsule-summary">
        <p className="eyebrow">Forecast preview</p>
        <div style={{ display:'flex', gap: 6, alignItems:'baseline' }}>
          <span className="display" style={{ fontSize: 36 }}>18–24°</span>
          <span className="caption">Mostly sunny · 1 day rain</span>
        </div>
      </div>
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Adjust if needed</p>
        <div className="chip-row">
          {['Mild · 18-24°','Hot · 25°+','Cool · 10-17°','Cold · <10°','Mixed','Rainy'].map((w) => (
            <button key={w} className={`chip-pill${weather === w ? ' active' : ''}`} onClick={() => setWeather(w)}>{w}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep(4)}>Quick build</button>
        <button className="btn" style={{ flex: 2 }} onClick={() => nav.push({ id:'travelMustHaves', props:{ dest, days }})}>Pick must-haves →</button>
      </div>
    </ScreenShell>
  );

  // Step 4 — final capsule
  return (
    <ScreenShell title="Capsule" eyebrow={`${dest.toUpperCase()} · ${days} DAYS`} onBack={back} action={{ label: 'Share', onClick: () => {} }}>
      <div className="capsule-summary">
        <p className="eyebrow">Your capsule</p>
        <h1 className="page-title" style={{ fontSize: 28, lineHeight: 1.1 }}>14 pieces, 18 outfits</h1>
        <p style={{ fontSize: 12.5, color:'var(--fg-2)', lineHeight: 1.5 }}>{trip.toLowerCase()} trip · {weather.toLowerCase()}</p>
      </div>

      {/* Outfit previews */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 10 }}>
          <p className="eyebrow">Outfits ({days})</p>
          <span className="caption">One per day</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
          {[
            ['Day 1 · Arrival', [32, 38, 28, 200]],
            ['Day 2 · Walking', [200, 32, 28, 45]],
            ['Day 3 · Dinner', [18, 28, 200, 32]],
            ['Day 4 · Coast', [200, 38, 32, 45]],
            ['Day 5 · Travel', [45, 32, 28, 200]],
          ].slice(0, days).map(([name, hues], i) => (
            <button key={i} onClick={() => nav.push({ id: 'outfit', props: { name, kicker: 'CAPSULE' }})} style={{ all:'unset', cursor:'pointer' }}>
              <OutfitCard name={name} sub={`OUTFIT ${i+1}`} hues={hues} />
            </button>
          ))}
        </div>
      </div>

      {/* Pieces by category */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Outerwear · 2</p>
        <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
          <span className="capsule-pill">Wool overshirt</span>
          <span className="capsule-pill">Sand chore</span>
        </div>
      </div>
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Tops · 5</p>
        <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
          {['Cream tee','Linen henley','Black tee','Striped knit','Oxford shirt'].map((t, i) => <span key={i} className="capsule-pill">{t}</span>)}
        </div>
      </div>
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Bottoms · 4</p>
        <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
          {['Linen trouser','Black denim','Wool trouser','Shorts'].map((t, i) => <span key={i} className="capsule-pill">{t}</span>)}
        </div>
      </div>
      <div>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Shoes · 3</p>
        <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
          {['Bone sneaker','Chocolate loafer','Leather sandal'].map((t, i) => <span key={i} className="capsule-pill">{t}</span>)}
        </div>
      </div>

      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 2 }} onClick={() => nav.push({ id:'travelPacking', props:{ dest, days }})}>See packing list →</button>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep(0)}>Restart</button>
      </div>
    </ScreenShell>
  );
}

// =================== WARDROBE GAPS ===================
function WardrobeGapsScreen() {
  const nav = useNav();
  const gaps = [
    ['Light raincoat', 'Missed 4 forecasted rainy days', 12],
    ['Brown leather belt', "Pulls 6 outfits together", 38],
    ['White button-up', 'Most-worn category at 78%', 70],
    ['Wool socks', 'Only 2 pairs in rotation', 22],
    ['Cap or hat', 'Sun protection gap on weekends', 8],
  ];
  return (
    <ScreenShell title="Wardrobe Gaps" eyebrow="LAST 90 DAYS">
      <div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>5 missing pieces</h1>
        <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>Identified from your wear patterns and weather data.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
        {gaps.map(([name, why, score], i) => (
          <button key={i} className="gap-card" onClick={() => nav.push({ id:'shopGap', props:{ gap: name }})} style={{ textAlign:'left', cursor:'pointer', font:'inherit', color:'inherit' }}>
            <div className="gap-icon"><Icon.Tshirt /></div>
            <div className="gap-meta">
              <span className="gap-title">{name}</span>
              <span className="gap-sub">{why}</span>
              <div className="gap-bar"><div className="gap-bar-fill" style={{ width: score + '%' }} /></div>
            </div>
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

// =================== SETTINGS — editorial redesign ===================
function SettingsScreen() {
  const nav = useNav();
  const [units, setUnits] = React.useState('Metric');
  const [notifs, setNotifs] = React.useState(true);
  const [weather, setWeather] = React.useState(true);

  return (
    <ScreenShell title="Settings">
      {/* Hero profile card */}
      <button onClick={() => nav.push('profile')} style={{
        all: 'unset', cursor: 'pointer',
        padding: 16, borderRadius: 18,
        background: 'linear-gradient(180deg, var(--card), color-mix(in oklab, var(--card) 92%, transparent)), radial-gradient(circle at 100% 0%, var(--accent-soft), transparent 60%)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div className="profile-avatar" style={{ width: 56, height: 56, fontSize: 24 }}>B</div>
        <div style={{ flex: 1, display:'flex', flexDirection:'column', gap: 2 }}>
          <span className="eyebrow">Profile</span>
          <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 20, fontWeight: 500, color:'var(--fg)' }}>Borna Krneta</span>
          <span className="caption">borna@example.com</span>
        </div>
        <Icon.Chevron />
      </button>

      <div>
        <p className="settings-section-label">Preferences</p>
        <div className="settings-group">
          <button className="settings-row" onClick={() => setUnits(units === 'Metric' ? 'Imperial' : 'Metric')}>
            <span className="sr-icon"><Icon.Sun /></span>
            <span className="sr-label">Units</span>
            <span className="sr-value">{units}</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row">
            <span className="sr-icon"><Icon.Calendar /></span>
            <span className="sr-label">Week starts on</span>
            <span className="sr-value">Monday</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('settingsAppearance')}>
            <span className="sr-icon"><Icon.Sun /></span>
            <span className="sr-label">Appearance</span>
            <span className="sr-value">{nav.theme === 'dark' ? 'Dark' : 'Light'}</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>

      <div>
        <p className="settings-section-label">Style profile</p>
        <div className="settings-group">
          <button className="settings-row" onClick={() => nav.push('settingsStyle')}>
            <span className="sr-icon"><Icon.Sparkles /></span>
            <span className="sr-label">Aesthetic</span>
            <span className="sr-value">Quiet luxe</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('settingsStyle')}>
            <span className="sr-icon"><Icon.Tshirt /></span>
            <span className="sr-label">Sizes & fit</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('settingsStyle')}>
            <span className="sr-icon"><Icon.Smile /></span>
            <span className="sr-label">Color preferences</span>
            <span className="sr-value">Earth · Neutral</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>

      <div>
        <p className="settings-section-label">Notifications</p>
        <div className="settings-group">
          <div className="settings-row" style={{ cursor:'default' }}>
            <span className="sr-icon"><Icon.Sparkles /></span>
            <span className="sr-label">Daily outfit suggestion</span>
            <div className={`toggle-pill${notifs ? ' on' : ''}`} onClick={() => setNotifs(!notifs)} />
          </div>
          <div className="settings-row" style={{ cursor:'default' }}>
            <span className="sr-icon"><Icon.Sun /></span>
            <span className="sr-label">Weather alerts</span>
            <div className={`toggle-pill${weather ? ' on' : ''}`} onClick={() => setWeather(!weather)} />
          </div>
          <button className="settings-row" onClick={() => nav.push('settingsNotifications')}>
            <span className="sr-icon"><Icon.Calendar /></span>
            <span className="sr-label">All notifications</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>

      <div>
        <p className="settings-section-label">Wardrobe</p>
        <div className="settings-group">
          <button className="settings-row" onClick={() => nav.push('wishlist')}>
            <span className="sr-icon"><Icon.Sparkles /></span>
            <span className="sr-label">Wishlist</span>
            <span className="sr-value">4 items</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('laundry')}>
            <span className="sr-icon"><Icon.Washer /></span>
            <span className="sr-label">Laundry</span>
            <span className="sr-value">6 dirty</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('gaps')}>
            <span className="sr-icon"><Icon.Gaps /></span>
            <span className="sr-label">Wardrobe gaps</span>
            <span className="sr-value">5 found</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>

      <div>
        <p className="settings-section-label">Membership</p>
        <div className="settings-group">
          <button className="settings-row" onClick={() => nav.push('paywall')}>
            <span className="sr-icon" style={{ color:'var(--accent)' }}><Icon.Sparkles /></span>
            <span className="sr-label">Subscription</span>
            <span className="sr-value" style={{ color:'var(--accent)' }}>Free · upgrade</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>

      <div>
        <p className="settings-section-label">Support</p>
        <div className="settings-group">
          <button className="settings-row" onClick={() => nav.push('help')}>
            <span className="sr-icon"><Icon.Chat /></span>
            <span className="sr-label">Help & guides</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('onboarding')}>
            <span className="sr-icon"><Icon.Sparkles /></span>
            <span className="sr-label">Replay onboarding</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>

      <div>
        <p className="settings-section-label">Data</p>
        <div className="settings-group">
          <button className="settings-row">
            <span className="sr-icon"><Icon.Upload /></span>
            <span className="sr-label">Export wardrobe</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('settingsAccount')}>
            <span className="sr-icon"><Icon.Link /></span>
            <span className="sr-label">Connected accounts</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('settingsPrivacy')}>
            <span className="sr-icon"><Icon.Sparkles /></span>
            <span className="sr-label">Privacy</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
          <button className="settings-row" onClick={() => nav.push('deleteAccount')} style={{ color:'#c25b4a' }}>
            <span className="sr-icon" style={{ color:'#c25b4a' }}><Icon.Close /></span>
            <span className="sr-label">Delete account</span>
          </button>
          <button className="settings-row" style={{ color:'#c25b4a' }}>
            <span className="sr-icon" style={{ color:'#c25b4a' }}><Icon.Close /></span>
            <span className="sr-label">Sign out</span>
          </button>
        </div>
      </div>

      <p className="caption" style={{ textAlign:'center', opacity: 0.6, paddingTop: 8 }}>BURS · 2.0.4</p>
    </ScreenShell>
  );
}

// =================== PROFILE ===================
function ProfileScreen() {
  const nav = useNav();
  return (
    <ScreenShell title="Profile" action={{ label: 'Edit', onClick: () => {} }}>
      <div className="profile-hero">
        <div className="profile-avatar">B</div>
        <div className="profile-name">Borna Krneta</div>
        <div className="profile-email">borna@example.com</div>
      </div>
      <div className="stat-strip">
        <div className="cell"><div className="num">142</div><div className="lbl">Garments</div></div>
        <div className="cell"><div className="num">38</div><div className="lbl">Outfits</div></div>
        <div className="cell"><div className="num">186</div><div className="lbl">Wears</div></div>
      </div>

      <div>
        <p className="settings-section-label">Account</p>
        <div className="settings-group">
          <button className="settings-row" onClick={() => nav.push('settings')}>
            <span className="sr-icon"><Icon.Gear /></span>
            <span className="sr-label">Settings</span>
            <span className="sr-trail"><Icon.Chevron /></span>
          </button>
        </div>
      </div>
    </ScreenShell>
  );
}

// =================== NOTIFICATIONS ===================
function NotificationsScreen() {
  const items = [
    { unread: true, icon: <Icon.Sun />, title: 'Rain expected tomorrow', body: 'Your wool overshirt isn\'t waterproof — try the canvas chore.', time: 'Just now' },
    { unread: true, icon: <Icon.Sparkles />, title: 'Today\'s outfit is ready', body: 'Studio brunch — based on the gallery opening at 11.', time: '7:00 AM' },
    { unread: false, icon: <Icon.Tshirt />, title: 'Bone sneakers worn 12 times', body: 'Consider rotating in your loafers this week.', time: 'Yesterday' },
    { unread: false, icon: <Icon.Calendar />, title: 'Tuesday is unplanned', body: 'Block 30 seconds to plan it now.', time: '2d ago' },
    { unread: false, icon: <Icon.Outfits />, title: 'New outfit saved', body: 'Sunday casual — added from Style Me.', time: '4d ago' },
  ];
  return (
    <ScreenShell title="Notifications" action={{ label: 'Clear', onClick: () => {} }}>
      <div>
        <p className="settings-section-label">New</p>
        <div style={{ display:'flex', flexDirection:'column', gap: 8, paddingLeft: 14 }}>
          {items.filter(x => x.unread).map((n, i) => (
            <div key={i} className="notif-row">
              <span className="notif-dot" />
              <div className="notif-icon">{n.icon}</div>
              <div className="notif-meta">
                <div className="notif-title">{n.title}</div>
                <div className="notif-body">{n.body}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="settings-section-label">Earlier</p>
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {items.filter(x => !x.unread).map((n, i) => (
            <div key={i} className="notif-row">
              <div className="notif-icon">{n.icon}</div>
              <div className="notif-meta">
                <div className="notif-title">{n.title}</div>
                <div className="notif-body">{n.body}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}

// =================== GARMENT DETAIL — editorial redesign ===================
function GarmentDetailScreen({ name = 'Wool overshirt', sub = 'Outer · Wool' }) {
  const hue = 32;
  return (
    <ScreenShell title="Garment" action={{ label: 'Edit', onClick: () => nav.push({ id:'editGarment', props:{ name:'Linen tee', hue: 32 }}) }}>
      <div style={{ height: 280, borderRadius: 22, background: hueGrad(hue), border:'1px solid var(--border)' }} />
      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>{sub.toUpperCase()}</p>
        <h1 className="page-title" style={{ fontSize: 28 }}>{name}</h1>
      </div>
      <div className="garment-tags" style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
        {['Beige','Wool','Mid-weight','Workwear','3-season','Quiet luxe'].map((t, i) => (
          <span key={i} className="capsule-pill">{t}</span>
        ))}
      </div>

      {/* Stat strip */}
      <div className="stat-strip">
        <div className="cell"><div className="num">23</div><div className="lbl">Times worn</div></div>
        <div className="cell"><div className="num">$8.20</div><div className="lbl">Per wear</div></div>
        <div className="cell"><div className="num">18d</div><div className="lbl">Last worn</div></div>
      </div>

      <div className="settings-group">
        <div className="settings-row" style={{ cursor:'default' }}><span className="sr-label">Brand</span><span className="sr-value">Folk</span></div>
        <div className="settings-row" style={{ cursor:'default' }}><span className="sr-label">Bought</span><span className="sr-value">Mar 2024</span></div>
        <div className="settings-row" style={{ cursor:'default' }}><span className="sr-label">Status</span><span className="sr-value" style={{ color:'var(--accent)' }}>Clean · Hung</span></div>
      </div>

      <div style={{ display:'flex', gap: 8 }}>
        <button className="btn btn-block" style={{ flex: 1 }}>Build outfit</button>
        <button className="btn btn-outline">Mark dirty</button>
      </div>
    </ScreenShell>
  );
}

// =================== SEARCH ===================
function SearchScreen() {
  const [q, setQ] = React.useState('');
  const nav = useNav();
  const recents = ['linen trouser', 'beige knit', 'sneakers', 'wool overshirt'];
  const suggestions = ['Color: cream', 'Fit: tailored', 'Season: SS', 'Mood: quiet luxe', 'Unworn 60d+'];
  return (
    <ScreenShell title="Search">
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left: 14, top:'50%', transform:'translateY(-50%)', color:'var(--fg-2)' }}><Icon.Search /></span>
        <input className="composer-input" placeholder="Search 142 garments…" autoFocus value={q} onChange={e => setQ(e.target.value)} style={{ borderRadius: 14, padding: '14px 14px 14px 42px', width:'100%' }} />
      </div>
      {!q && (
        <>
          <div>
            <p className="settings-section-label">Recent</p>
            <div className="chip-row">{recents.map((r, i) => <button key={i} className="chip-pill" onClick={() => setQ(r)}>{r}</button>)}</div>
          </div>
          <div>
            <p className="settings-section-label">Try</p>
            <div className="chip-row">{suggestions.map((r, i) => <button key={i} className="chip-pill">{r}</button>)}</div>
          </div>
        </>
      )}
      {!!q && (
        <div>
          <p className="settings-section-label">{q.length < 3 ? 'Type more…' : '4 results'}</p>
          {q.length >= 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
              {[
                ['Wool overshirt', 'Outerwear · Beige · Worn 23x', 32],
                ['Linen trouser', 'Bottoms · Cream · Worn 14x', 38],
                ['Bone sneaker', 'Shoes · Bone · Worn 12x', 28],
                ['Cream knit tee', 'Tops · Cream · Worn 31x', 32],
              ].map(([t, s, h], i) => (
                <button key={i} className="list-row" onClick={() => nav.push({ id:'garment', props:{ name:t, sub:s }})}>
                  <div className="lr-thumb" style={{ background: hueGrad(h) }} />
                  <div className="lr-meta"><span className="lr-title">{t}</span><span className="lr-sub">{s}</span></div>
                  <span className="lr-trail"><Icon.Chevron /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ScreenShell>
  );
}

// =================== FILTERS ===================
function FiltersScreen() {
  return (
    <ScreenShell title="Filters" action={{ label: 'Reset', onClick: () => {} }}>
      <div><p className="eyebrow" style={{ marginBottom: 8 }}>Category</p>
        <div className="chip-row">{['All','Outerwear','Tops','Bottoms','Shoes','Accessories','Bags'].map((t, i) => <button key={i} className={`chip-pill${i===0?' active':''}`}>{t}</button>)}</div>
      </div>
      <div><p className="eyebrow" style={{ marginBottom: 8 }}>Color</p>
        <div className="chip-row">{['Cream','Beige','Brown','Black','Navy','Olive','Gold','Off-white'].map((t, i) => <button key={i} className={`chip-pill${i===0?' active':''}`}>{t}</button>)}</div>
      </div>
      <div><p className="eyebrow" style={{ marginBottom: 8 }}>Season</p>
        <div className="chip-row">{['SS','FW','3-season','All'].map((t, i) => <button key={i} className={`chip-pill${i===2?' active':''}`}>{t}</button>)}</div>
      </div>
      <div><p className="eyebrow" style={{ marginBottom: 8 }}>Status</p>
        <div className="chip-row">{['Clean','Dirty','Laundry','Storage'].map((t, i) => <button key={i} className={`chip-pill${i===0?' active':''}`}>{t}</button>)}</div>
      </div>
      <button className="btn btn-block">Apply · 142 garments</button>
    </ScreenShell>
  );
}

Object.assign(window, {
  ScreenShell, OutfitCard,
  OutfitDetailScreen, StyleChatScreen, OutfitsScreen, StyleMeScreen, MoodOutfitScreen,
  TravelCapsuleScreen, WardrobeGapsScreen, SettingsScreen, ProfileScreen, NotificationsScreen,
  GarmentDetailScreen, SearchScreen, FiltersScreen,
});

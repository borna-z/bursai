/* Burs — additional screens (onboarding, planning, laundry, paywall, etc.)
   Depends on globals: React, Icon, StatusBar, BottomNav, useNav, ScreenShell, OutfitCard.
*/

const { useNav: _useNav } = window;
// Helper: hue placeholder gradient
const _hueGrad = (h) => `linear-gradient(135deg, hsl(${h} 38% 78%), hsl(${(h+30)%360} 30% 62%))`;

// =================== ONBOARDING — single connected flow ===================
// Steps: welcome → signin → questionnaire (style/sizes/climate) → permissions
//        → import wardrobe → first outfit → done
function OnboardingScreen({ step: initialStep = 0 }) {
  const nav = _useNav();
  const [step, setStep] = React.useState(initialStep);
  const [authMode, setAuthMode] = React.useState('signup'); // 'signup' | 'signin'
  const [pickedStyles, setPickedStyles] = React.useState([]);
  const [climate, setClimate] = React.useState(null);
  const [sizeTop, setSizeTop] = React.useState(null);
  const [sizeBottom, setSizeBottom] = React.useState(null);
  const [perms, setPerms] = React.useState({ camera: false, notif: false, location: false });
  const [imported, setImported] = React.useState(0);
  const TOTAL = 7;

  const next = () => setStep(s => Math.min(TOTAL - 1, s + 1));
  const back = () => step === 0 ? nav.pop() : setStep(s => s - 1);
  const finish = () => nav.replace('home');

  const togglePick = (val, list, setList) =>
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);

  const Dots = () => (
    <div style={{ display:'flex', gap: 4, justifyContent:'center', padding:'8px 0 4px' }}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div key={i} style={{
          width: i === step ? 18 : 6, height: 6, borderRadius: 999,
          background: i === step ? 'var(--accent)' : i < step ? 'var(--fg)' : 'var(--border)',
          transition: 'all 240ms ease',
        }}/>
      ))}
    </div>
  );

  const Header = ({ kicker }) => (
    <div style={{ padding:'10px 16px 8px', display:'flex', alignItems:'center', gap: 10, borderBottom:'1px solid var(--border)' }}>
      <button className="icon-btn ghost" onClick={back}><Icon.Back /></button>
      <div style={{ flex: 1, textAlign:'center' }}>
        <p className="eyebrow">{kicker}</p>
      </div>
      {step < TOTAL - 1 ? (
        <button className="btn-quiet" style={{ background:'transparent', border:0, fontSize: 13, color:'var(--fg-2)', fontWeight: 500, cursor:'pointer' }} onClick={() => setStep(TOTAL - 1)}>Skip</button>
      ) : <div style={{ width: 36 }} />}
    </div>
  );

  // ---------- step 0 — Welcome ----------
  if (step === 0) {
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <div style={{ flex: 1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', padding:'40px 28px', gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 22, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 34, color:'var(--accent-fg)', lineHeight: 1 }}>B</span>
            </div>
            <p className="eyebrow">Burs · A wardrobe, considered</p>
            <h1 className="display" style={{ fontSize: 42, lineHeight: 1.05, textAlign:'center', maxWidth: 280 }}>Your wardrobe, <span style={{ color:'var(--accent)' }}>finally worn</span></h1>
            <p style={{ fontSize: 14, color:'var(--fg-2)', lineHeight: 1.5, textAlign:'center', maxWidth: 280 }}>Build outfits from what you already own. We’ll handle the styling, the planning, and the quiet maths of cost-per-wear.</p>
          </div>
          <div style={{ padding:'0 20px 28px', display:'flex', flexDirection:'column', gap: 8 }}>
            <button className="btn btn-block" onClick={() => { setAuthMode('signup'); next(); }}>Get started</button>
            <button className="btn btn-quiet btn-block" onClick={() => { setAuthMode('signin'); next(); }}>I already have an account</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }

  // ---------- step 1 — Sign up / Sign in ----------
  if (step === 1) {
    const isSignup = authMode === 'signup';
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <Header kicker={isSignup ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'} />
          <div style={{ padding:'18px 20px', flex: 1, display:'flex', flexDirection:'column', gap: 14 }}>
            <Dots />
            <h1 className="page-title">{isSignup ? 'A few details' : 'Sign in'}</h1>
            <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>{isSignup ? 'We’ll keep this simple — and your wardrobe private.' : 'Pick up where you left off.'}</p>

            {isSignup && (
              <label style={{ display:'flex', flexDirection:'column', gap: 6 }}>
                <span className="eyebrow">Name</span>
                <input className="ob-input" defaultValue="Borna" />
              </label>
            )}
            <label style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              <span className="eyebrow">Email</span>
              <input className="ob-input" type="email" placeholder="you@example.com" />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              <span className="eyebrow">Password</span>
              <input className="ob-input" type="password" placeholder="••••••••" />
            </label>

            <div style={{ display:'flex', alignItems:'center', gap: 10, margin:'8px 0' }}>
              <div style={{ flex: 1, height: 1, background:'var(--border)' }} />
              <span className="caption">or</span>
              <div style={{ flex: 1, height: 1, background:'var(--border)' }} />
            </div>
            <button className="btn btn-outline btn-block" onClick={next}>Continue with Apple</button>
            <button className="btn btn-outline btn-block" onClick={next}>Continue with Google</button>

            <button className="btn-quiet" style={{ background:'transparent', border:0, color:'var(--fg-2)', fontSize: 12, marginTop: 4, cursor:'pointer' }} onClick={() => setAuthMode(isSignup ? 'signin' : 'signup')}>
              {isSignup ? 'Have an account? Sign in.' : 'New here? Create an account.'}
            </button>
          </div>
          <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-block" onClick={next}>{isSignup ? 'Create account' : 'Sign in'}</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }

  // ---------- step 2 — Style questionnaire ----------
  if (step === 2) {
    const styles = ['Quiet luxe', 'Tailored', 'Streetwear', 'Workwear', 'Romantic', 'Minimal', 'Heritage', 'Playful', 'Sporty'];
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <Header kicker="STYLE" />
          <div style={{ padding:'14px 20px', flex: 1, overflowY:'auto', display:'flex', flexDirection:'column', gap: 14 }}>
            <Dots />
            <h1 className="page-title">How would you describe your style?</h1>
            <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>Pick three. We use these as a quiet bias when we suggest outfits.</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 6, marginTop: 4 }}>
              {styles.map(s => (
                <button key={s}
                  className={`chip${pickedStyles.includes(s) ? ' active' : ''}`}
                  onClick={() => togglePick(s, pickedStyles, setPickedStyles)}
                  style={{ height: 34, padding:'0 14px', fontSize: 12 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-block" onClick={next} disabled={pickedStyles.length === 0} style={{ opacity: pickedStyles.length === 0 ? 0.45 : 1 }}>Continue</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }

  // ---------- step 3 — Sizes + climate ----------
  if (step === 3) {
    const tops = ['XS','S','M','L','XL'];
    const bottoms = ['28','30','32','34','36'];
    const climates = [
      ['Mild', 'Coastal · 8–22°'],
      ['Cold', 'Continental · −5–18°'],
      ['Hot',  'Desert · 22–40°'],
      ['Mixed','Four seasons'],
    ];
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <Header kicker="SIZES & CLIMATE" />
          <div style={{ padding:'14px 20px', flex: 1, overflowY:'auto', display:'flex', flexDirection:'column', gap: 16 }}>
            <Dots />
            <h1 className="page-title">A bit about you</h1>

            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Tops</p>
              <div style={{ display:'flex', gap: 6 }}>
                {tops.map(s => (
                  <button key={s} className={`chip${sizeTop === s ? ' active' : ''}`} onClick={() => setSizeTop(s)} style={{ flex: 1, height: 38, fontSize: 12 }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Bottoms (waist)</p>
              <div style={{ display:'flex', gap: 6 }}>
                {bottoms.map(s => (
                  <button key={s} className={`chip${sizeBottom === s ? ' active' : ''}`} onClick={() => setSizeBottom(s)} style={{ flex: 1, height: 38, fontSize: 12 }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Climate where you live</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
                {climates.map(([n, sub]) => (
                  <button key={n}
                    className="option-card"
                    onClick={() => setClimate(n)}
                    style={{ textAlign:'left', cursor:'pointer', borderColor: climate === n ? 'var(--accent)' : 'var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing:'-0.01em' }}>{n}</div>
                      <p style={{ fontSize: 10.5, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:'0.14em', marginTop: 3 }}>{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-block" onClick={next} disabled={!sizeTop || !sizeBottom || !climate} style={{ opacity: (!sizeTop || !sizeBottom || !climate) ? 0.45 : 1 }}>Continue</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }

  // ---------- step 4 — Permissions ----------
  if (step === 4) {
    const items = [
      { k: 'camera',   icon: <Icon.Camera />, t: 'Camera', d: 'Scan garments and shoot photos in-app.' },
      { k: 'notif',    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>, t: 'Notifications', d: 'Weather alerts and outfit reminders.' },
      { k: 'location', icon: <Icon.Sun />,    t: 'Location', d: 'Local weather to inform daily outfits.' },
    ];
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <Header kicker="PERMISSIONS" />
          <div style={{ padding:'14px 20px', flex: 1, display:'flex', flexDirection:'column', gap: 16 }}>
            <Dots />
            <h1 className="page-title">A few quiet permissions</h1>
            <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>Each one is optional. You can change them later in Settings.</p>
            <div style={{ display:'flex', flexDirection:'column', gap: 8, marginTop: 4 }}>
              {items.map(it => (
                <div key={it.k} style={{ display:'flex', alignItems:'center', gap: 12, padding:'14px', borderRadius: 14, border:'1px solid var(--border)', background:'var(--card)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background:'var(--accent-soft)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>{it.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, letterSpacing:'-0.01em' }}>{it.t}</p>
                    <p style={{ fontSize: 11.5, color:'var(--fg-2)', marginTop: 2, lineHeight: 1.4 }}>{it.d}</p>
                  </div>
                  <button
                    className={`toggle-pill${perms[it.k] ? ' on' : ''}`}
                    onClick={() => setPerms(p => ({ ...p, [it.k]: !p[it.k] }))}
                    aria-label={`Toggle ${it.t}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-block" onClick={next}>Continue</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }

  // ---------- step 5 — Import wardrobe ----------
  if (step === 5) {
    const sources = [
      ['Camera roll', 'Pick photos from your phone', <Icon.Image />],
      ['Live scan',   'Place pieces on a flat surface', <Icon.Camera />],
      ['Skip for now', 'Add pieces later', <Icon.Plus />],
    ];
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <Header kicker="BUILD YOUR WARDROBE" />
          <div style={{ padding:'14px 20px', flex: 1, display:'flex', flexDirection:'column', gap: 14 }}>
            <Dots />
            <h1 className="page-title">Bring your pieces in</h1>
            <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>Add a handful — even ten makes Burs useful right away.</p>

            <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
              {sources.map(([n, sub, ic], i) => (
                <button key={i} className="option-card" onClick={() => { if (i < 2) setImported(c => c + Math.floor(Math.random()*5)+3); }} style={{ textAlign:'left', cursor:'pointer' }}>
                  <div>
                    <p style={{ fontSize: 14.5, fontWeight: 600, letterSpacing:'-0.01em' }}>{n}</p>
                    <p style={{ fontSize: 12, color:'var(--fg-2)', marginTop: 2 }}>{sub}</p>
                  </div>
                  <div className="option-icon">{ic}</div>
                </button>
              ))}
            </div>

            {imported > 0 && (
              <div className="card-hero" style={{ marginTop: 4 }}>
                <p className="eyebrow" style={{ marginBottom: 4 }}>So far</p>
                <p className="display" style={{ fontSize: 22 }}>
                  <span style={{ color:'var(--accent)' }}>{imported}</span>
                  <span style={{ color:'var(--fg-3)' }}> pieces added</span>
                </p>
              </div>
            )}
          </div>
          <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-block" onClick={next}>Continue</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }

  // ---------- step 6 — First outfit + done ----------
  if (step === 6) {
    return (
      <div className="device theme-light">
        <StatusBar />
        <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column' }}>
          <Header kicker="ALL SET" />
          <div style={{ padding:'18px 20px', flex: 1, display:'flex', flexDirection:'column', gap: 14 }}>
            <Dots />
            <h1 className="page-title">Your first outfit</h1>
            <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5 }}>We styled this from the pieces you brought. Wear it tomorrow — or keep exploring.</p>
            <OutfitCard name="Studio brunch" sub="MON · 18°" hues={[32, 28, 200, 18]} />
            <p className="caption" style={{ textAlign:'center', opacity: 0.7, marginTop: 4 }}>You can change everything from Settings.</p>
          </div>
          <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-block" onClick={finish}>Enter Burs</button>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    );
  }
  return null;
}

// =================== CREATE / EDIT OUTFIT (manual builder) ===================
function CreateOutfitScreen() {
  const nav = _useNav();
  const [name, setName] = React.useState('Untitled outfit');
  const [slot, setSlot] = React.useState('top');
  const [picked, setPicked] = React.useState({ top: null, bottom: null, shoes: null, outer: null });
  const slots = [
    ['top',    'Top',    32],
    ['bottom', 'Bottom', 28],
    ['shoes',  'Shoes',  45],
    ['outer',  'Outer',  18],
  ];
  // Mock garments (same hue trick)
  const garments = [
    { id: 1, name: 'Cream linen tee',  hue: 32, slot: 'top' },
    { id: 2, name: 'Wool overshirt',   hue: 18, slot: 'outer' },
    { id: 3, name: 'White oxford',     hue: 200, slot: 'top' },
    { id: 4, name: 'Charcoal trouser', hue: 28, slot: 'bottom' },
    { id: 5, name: 'Olive chino',      hue: 75, slot: 'bottom' },
    { id: 6, name: 'Camel loafer',     hue: 45, slot: 'shoes' },
    { id: 7, name: 'Canvas sneaker',   hue: 200, slot: 'shoes' },
    { id: 8, name: 'Navy trench',      hue: 220, slot: 'outer' },
  ];
  const visible = garments.filter(g => g.slot === slot);

  return (
    <div className="device theme-light">
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 16px 8px', display:'flex', alignItems:'center', gap: 10, borderBottom:'1px solid var(--border)' }}>
          <button className="icon-btn ghost" onClick={nav.pop}><Icon.Back /></button>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>NEW OUTFIT</p>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ background:'transparent', border:0, fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontWeight: 500, fontSize: 18, letterSpacing:'-0.01em', color:'var(--fg)', width:'100%', outline:'none' }}/>
          </div>
          <button className="screen-action" onClick={() => nav.replace('outfits')}>Save</button>
        </div>

        {/* Outfit preview — 2x2 slot grid */}
        <div style={{ padding:'12px 20px 8px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
            {slots.map(([k, label]) => {
              const g = picked[k];
              return (
                <button key={k}
                  onClick={() => setSlot(k)}
                  style={{
                    aspectRatio: '1 / 1.05', borderRadius: 14,
                    border: slot === k ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 10, cursor:'pointer', textAlign:'left', background: g ? _hueGrad(g.hue) : 'var(--bg-2)',
                    color: g ? 'var(--bg)' : 'var(--fg-2)', position:'relative', overflow:'hidden',
                  }}>
                  <p className="eyebrow" style={{ color:'inherit', opacity: g ? 0.95 : 0.7 }}>{label}</p>
                  {g ? (
                    <p style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontWeight: 500, fontSize: 15, position:'absolute', bottom: 10, left: 10, right: 10, lineHeight: 1.1 }}>{g.name}</p>
                  ) : (
                    <p style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>Tap to add</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot picker — horizontal chips */}
        <div style={{ padding:'8px 20px 0', display:'flex', gap: 6, overflowX:'auto', flexShrink: 0 }}>
          {slots.map(([k, label]) => (
            <button key={k} className={`chip${slot === k ? ' active' : ''}`} onClick={() => setSlot(k)}>{label}</button>
          ))}
        </div>

        {/* Garments grid */}
        <div style={{ padding:'12px 20px 16px', overflowY:'auto', flex: 1 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Pick a {slot}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 6 }}>
            {visible.map(g => (
              <button key={g.id}
                onClick={() => { setPicked(p => ({ ...p, [slot]: g })); }}
                style={{
                  aspectRatio: 1, borderRadius: 10, border: picked[slot]?.id === g.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  padding: 0, cursor:'pointer', position:'relative', overflow:'hidden', background: _hueGrad(g.hue),
                }}>
                <span style={{ position:'absolute', bottom: 4, left: 4, right: 4, fontSize: 9, fontWeight: 700, color:'var(--bg)', background:'color-mix(in oklab, var(--fg) 75%, transparent)', padding:'2px 5px', borderRadius: 999, textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap' }}>{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)', display:'flex', gap: 10, alignItems:'center' }}>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>{Object.values(picked).filter(Boolean).length}/4 slots filled</p>
            <p style={{ fontSize: 11, color:'var(--fg-2)' }}>Save when ready</p>
          </div>
          <button className="btn" onClick={() => nav.replace('outfits')}>Save outfit</button>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== PLAN — MONTH CALENDAR ===================
function PlanMonthScreen() {
  const nav = _useNav();
  const [sel, setSel] = React.useState(15);
  // Build 5x7 grid for current month (mock: 30 days starting Wed)
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = i - 2; // first row offset
    return d > 0 && d <= 30 ? d : null;
  });
  const planned = new Set([3, 7, 12, 15, 18, 22, 27, 29]);
  const worn = new Set([1, 2, 5, 8, 9, 11, 14, 16]);

  return (
    <div className="device theme-light">
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 16px 8px', display:'flex', alignItems:'center', gap: 10, borderBottom:'1px solid var(--border)' }}>
          <button className="icon-btn ghost" onClick={nav.pop}><Icon.Back /></button>
          <div style={{ flex: 1 }}>
            <p className="eyebrow">2026</p>
            <h1 className="page-title-sm" style={{ fontSize: 18 }}>April</h1>
          </div>
          <button className="icon-btn ghost"><Icon.Plus /></button>
        </div>

        <div style={{ padding:'12px 16px 0' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} style={{ textAlign:'center', fontSize: 9.5, textTransform:'uppercase', letterSpacing:'0.14em', color:'var(--fg-2)', padding: 6 }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap: 4 }}>
            {days.map((d, i) => (
              <button key={i}
                disabled={!d}
                onClick={() => d && setSel(d)}
                style={{
                  aspectRatio: '1 / 1.1',
                  borderRadius: 10,
                  border: sel === d ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: d && worn.has(d) ? 'var(--card-2)' : d ? 'var(--card)' : 'transparent',
                  opacity: d ? 1 : 0,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'6px 0',
                  cursor: d ? 'pointer' : 'default',
                }}>
                <span style={{ fontFamily: d === sel ? "'Playfair Display', serif" : 'DM Sans, sans-serif', fontStyle: d === sel ? 'italic' : 'normal', fontSize: 14, fontWeight: 500, color:'var(--fg)' }}>{d || ''}</span>
                {d && (
                  <span style={{
                    width: 4, height: 4, borderRadius: 999,
                    background: planned.has(d) ? 'var(--accent)' : worn.has(d) ? 'var(--fg-3)' : 'transparent',
                  }}/>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Selected day card */}
        <div style={{ padding:'14px 20px', flex: 1, overflowY:'auto', display:'flex', flexDirection:'column', gap: 12 }}>
          <p className="eyebrow">Selected · April {sel}</p>
          {planned.has(sel) ? (
            <OutfitCard name="Studio brunch" sub="PLANNED · 18°" hues={[32,28,200,18]} onUse={() => {}} onSave={() => {}} />
          ) : worn.has(sel) ? (
            <div className="card">
              <p className="eyebrow" style={{ marginBottom: 6 }}>Worn that day</p>
              <p className="display" style={{ fontSize: 18 }}>Wool overshirt + linen trouser</p>
              <p className="caption" style={{ marginTop: 4 }}>Logged automatically</p>
            </div>
          ) : (
            <div className="card-hero">
              <p className="eyebrow" style={{ marginBottom: 4 }}>Open day</p>
              <p className="display" style={{ fontSize: 18 }}>Nothing planned yet.</p>
              <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => nav.push('createOutfit')}>Plan an outfit</button>
            </div>
          )}
        </div>

        <div className="home-indicator" />
      </div>
    </div>
  );
}

// =================== LAUNDRY QUEUE ===================
function LaundryScreen() {
  const lanes = [
    { id: 'dirty',  label: 'Dirty', count: 6, hue: 18 },
    { id: 'wash',   label: 'In wash', count: 3, hue: 200 },
    { id: 'dry',    label: 'Drying', count: 2, hue: 45 },
    { id: 'clean',  label: 'Clean', count: 12, hue: 32 },
  ];
  const items = {
    dirty:  ['Wool overshirt', 'Charcoal trouser', 'White oxford', 'Linen tee', 'Olive chino', 'Black socks'],
    wash:   ['Cream knit', 'Striped tee', 'Linen shirt'],
    dry:    ['Denim jacket', 'Navy crew'],
    clean:  ['Cashmere sweater', 'Beige linen suit', 'Camel loafers', 'Pleated skirt'],
  };
  const [lane, setLane] = React.useState('dirty');

  return (
    <ScreenShell title="Laundry" eyebrow="WARDROBE · CARE">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 6 }}>
        {lanes.map(l => (
          <button key={l.id}
            onClick={() => setLane(l.id)}
            className="stat-block"
            style={{
              padding:'10px 8px', cursor:'pointer', textAlign:'center',
              borderColor: lane === l.id ? 'var(--accent)' : 'var(--border)',
              background: lane === l.id ? 'var(--card)' : 'var(--bg-2)',
            }}>
            <div className="num" style={{ fontSize: 22 }}>{l.count}</div>
            <div className="lbl" style={{ marginTop: 4, fontSize: 9 }}>{l.label}</div>
          </button>
        ))}
      </div>

      <p className="eyebrow" style={{ marginTop: 4 }}>{lanes.find(l => l.id === lane).label}</p>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {items[lane].map((n, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 12, padding:'10px 0', borderBottom: i < items[lane].length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 44, height: 56, borderRadius: 10, background: _hueGrad(((i*40)+lanes.find(l=>l.id===lane).hue)%360), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, letterSpacing:'-0.01em', color:'var(--fg)' }}>{n}</p>
              <p style={{ fontSize: 11, color:'var(--fg-2)', marginTop: 2 }}>{lane === 'clean' ? 'Ready to wear' : lane === 'dry' ? 'Drying · 2h left' : lane === 'wash' ? 'Cycle · 28m left' : 'Last worn 3d ago'}</p>
            </div>
            <button className="btn btn-quiet btn-sm">{lane === 'dirty' ? 'Start wash' : lane === 'clean' ? 'Put away' : 'Mark done'}</button>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

// =================== SHOP THE GAP ===================
function ShopGapScreen({ gap = 'Light raincoat' }) {
  const items = [
    { name: 'Stutterheim Stockholm', sub: 'Black · Long', price: '€420', hue: 220 },
    { name: 'Rains Curve Jacket',    sub: 'Olive · Mid', price: '€135', hue: 75 },
    { name: 'Patagonia Torrentshell',sub: 'Navy · Short',price: '€180', hue: 200 },
    { name: 'Arc’teryx Beta SL',     sub: 'Sand · Light',price: '€450', hue: 32 },
  ];
  return (
    <ScreenShell title="Shop the gap" eyebrow={`GAP · ${gap.toUpperCase()}`}>
      <div className="card-hero">
        <p className="eyebrow" style={{ marginBottom: 6 }}>Why this gap matters</p>
        <p className="display" style={{ fontSize: 19, lineHeight: 1.3 }}>You missed 4 forecasted rainy days last month — a quiet raincoat would close the loop.</p>
      </div>

      <p className="eyebrow">Curated picks</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ borderRadius: 14, border:'1px solid var(--border)', overflow:'hidden', background:'var(--card)' }}>
            <div style={{ aspectRatio: '4 / 5', background: _hueGrad(it.hue) }} />
            <div style={{ padding:'10px 12px 12px' }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing:'-0.01em', color:'var(--fg)' }}>{it.name}</p>
              <p style={{ fontSize: 10, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:'0.14em', marginTop: 3 }}>{it.sub}</p>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8 }}>
                <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 16, color:'var(--accent)' }}>{it.price}</span>
                <button className="btn btn-sm btn-outline">Save</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="caption" style={{ textAlign:'center', opacity: 0.6 }}>Curated. We don’t take a cut.</p>
    </ScreenShell>
  );
}

// =================== WISHLIST ===================
function WishlistScreen() {
  const items = [
    { name: 'Cashmere crew', sub: 'Cream · M',  price: '€280', hue: 32, status: 'Watching · in stock' },
    { name: 'Wool trouser',  sub: 'Charcoal · 32', price: '€190', hue: 28, status: 'Watching · in stock' },
    { name: 'Suede loafer',  sub: 'Camel · 42',  price: '€340', hue: 45, status: 'Out of stock' },
    { name: 'Linen overshirt', sub: 'Sand · L',  price: '€220', hue: 18, status: 'Watching · 1 left' },
  ];
  return (
    <ScreenShell title="Wishlist" eyebrow="SAVED · TRACKING">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
        <div className="stat-block"><div className="num">{items.length}</div><div className="lbl">Watching</div></div>
        <div className="stat-block"><div className="num">€1,030</div><div className="lbl">Total</div></div>
      </div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 12, padding:'12px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 56, height: 70, borderRadius: 10, background: _hueGrad(it.hue), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, letterSpacing:'-0.01em', color:'var(--fg)' }}>{it.name}</p>
              <p style={{ fontSize: 11, color:'var(--fg-2)', marginTop: 2 }}>{it.sub}</p>
              <p style={{ fontSize: 10, color: it.status.startsWith('Out') ? 'var(--fg-3)' : 'var(--accent)', textTransform:'uppercase', letterSpacing:'0.14em', marginTop: 4 }}>{it.status}</p>
            </div>
            <span style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 16, color:'var(--fg)' }}>{it.price}</span>
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

// =================== PAYWALL / SUBSCRIPTION ===================
function PaywallScreen() {
  const nav = _useNav();
  const [plan, setPlan] = React.useState('annual');
  const features = [
    'Unlimited wardrobe imports',
    'Travel capsule wizard',
    'Wardrobe gap analysis',
    'Cost-per-wear tracking',
    'Stylist chat — unlimited',
    'Priority support',
  ];
  return (
    <div className="device theme-light">
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 16px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button className="icon-btn ghost" onClick={nav.pop}><Icon.Close /></button>
          <button className="btn-quiet" style={{ background:'transparent', border:0, fontSize: 13, color:'var(--fg-2)', fontWeight: 500, cursor:'pointer' }}>Restore</button>
        </div>
        <div style={{ padding:'10px 24px 18px', flex: 1, display:'flex', flexDirection:'column', gap: 18, overflowY:'auto' }}>
          <p className="eyebrow" style={{ textAlign:'center' }}>BURS · MEMBERSHIP</p>
          <h1 className="display" style={{ fontSize: 30, lineHeight: 1.1, textAlign:'center' }}>The full wardrobe, <span style={{ color:'var(--accent)' }}>without the noise</span></h1>

          <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
            {[
              { id:'annual',  title:'Annual',  price:'€39', sub:'/year · 67% off', best: true },
              { id:'monthly', title:'Monthly', price:'€9',  sub:'/month · cancel anytime' },
            ].map(p => (
              <button key={p.id}
                onClick={() => setPlan(p.id)}
                className="option-card"
                style={{ textAlign:'left', cursor:'pointer', borderColor: plan === p.id ? 'var(--accent)' : 'var(--border)', borderWidth: plan === p.id ? 2 : 1 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, letterSpacing:'-0.01em' }}>{p.title}</p>
                    {p.best && <span className="chip active" style={{ height: 20, padding:'0 8px', fontSize: 9 }}>Best value</span>}
                  </div>
                  <p style={{ fontSize: 11.5, color:'var(--fg-2)', marginTop: 2 }}>{p.sub}</p>
                </div>
                <p style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 24, color:'var(--accent)' }}>{p.price}</p>
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            <p className="eyebrow">Includes</p>
            {features.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background:'var(--accent-soft)', color:'var(--accent)', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 13, color:'var(--fg)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)', background:'color-mix(in oklab, var(--bg) 92%, transparent)' }}>
          <button className="btn btn-block" onClick={nav.pop}>Continue · {plan === 'annual' ? '€39 / year' : '€9 / month'}</button>
          <p className="caption" style={{ textAlign:'center', opacity: 0.7, marginTop: 8 }}>Cancel anytime in App Store settings</p>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== HELP & SUPPORT ===================
function HelpScreen() {
  const groups = [
    ['Getting started', ['How to add your first piece', 'Building your first outfit', 'Importing from camera roll']],
    ['Daily use',       ['Planning the week', 'Style chat tips', 'Mood vs occasion']],
    ['Account',         ['Manage subscription', 'Export your data', 'Delete your account']],
    ['Privacy',         ['What we store', 'Where photos live', 'Third-party access']],
  ];
  return (
    <ScreenShell title="Help" eyebrow="SUPPORT · GUIDES">
      <div className="card-hero">
        <p className="eyebrow" style={{ marginBottom: 6 }}>Talk to a human</p>
        <p style={{ fontSize: 13.5, color:'var(--fg-2)', lineHeight: 1.5, marginBottom: 12 }}>Most replies inside 24h. Mon–Fri, in EN, FR, ES.</p>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ flex: 1 }}>Email us</button>
          <button className="btn btn-sm btn-outline" style={{ flex: 1 }}>Live chat</button>
        </div>
      </div>
      {groups.map(([title, items], i) => (
        <div key={i} className="settings-group">
          <p className="settings-section-label" style={{ paddingLeft: 4 }}>{title}</p>
          {items.map((q, j) => (
            <button key={j} className="settings-row">
              <span className="sr-icon"><Icon.Chevron /></span>
              <span className="sr-label">{q}</span>
              <span className="sr-trail"><Icon.Chevron /></span>
            </button>
          ))}
        </div>
      ))}
    </ScreenShell>
  );
}

// =================== DELETE ACCOUNT ===================
function DeleteAccountScreen() {
  const nav = _useNav();
  const [confirm, setConfirm] = React.useState('');
  return (
    <ScreenShell title="Delete account" eyebrow="ACCOUNT · IRREVERSIBLE">
      <div className="card-hero" style={{ background:'color-mix(in oklab, var(--card) 100%, transparent)' }}>
        <p className="eyebrow" style={{ color:'var(--accent)', marginBottom: 6 }}>This cannot be undone</p>
        <p style={{ fontSize: 14, color:'var(--fg)', lineHeight: 1.5 }}>Your wardrobe, outfits, plans and stylist memory will be removed within 30 days. You can export everything first.</p>
      </div>

      <button className="btn btn-outline btn-block">Export my data first</button>

      <div style={{ display:'flex', flexDirection:'column', gap: 6, marginTop: 4 }}>
        <p className="eyebrow">Type DELETE to confirm</p>
        <input className="ob-input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" />
      </div>

      <div style={{ display:'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={nav.pop}>Cancel</button>
        <button
          className="btn btn-sm"
          style={{ flex: 1, background: confirm === 'DELETE' ? 'var(--fg)' : 'var(--bg-2)', color: confirm === 'DELETE' ? 'var(--bg)' : 'var(--fg-3)', cursor: confirm === 'DELETE' ? 'pointer' : 'not-allowed' }}
          disabled={confirm !== 'DELETE'}
          onClick={nav.pop}>
          Delete account
        </button>
      </div>
    </ScreenShell>
  );
}

// =================== EMPTY / ERROR STATES ===================
function EmptyWardrobeScreen() {
  const nav = _useNav();
  return (
    <ScreenShell title="Wardrobe" eyebrow="EMPTY · GETTING STARTED" withTabBar="wardrobe">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', textAlign:'center', gap: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background:'var(--accent-soft)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon.Plus />
        </div>
        <h2 className="display" style={{ fontSize: 26, lineHeight: 1.1 }}>Nothing in here yet</h2>
        <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5, maxWidth: 260 }}>Add your first ten pieces and Burs starts styling you right away.</p>
        <button className="btn" onClick={() => nav.push('add')}>Add your first piece</button>
      </div>
    </ScreenShell>
  );
}

function NoConnectionScreen() {
  const nav = _useNav();
  return (
    <div className="device theme-light">
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', padding:'40px 28px', gap: 16, textAlign:'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background:'var(--bg-2)', color:'var(--fg-3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.6M2 8.8C5 6 9 4.5 13 4.8M19 11l3 3M22 8a14 14 0 0 0-3-2"/><circle cx="12" cy="20" r=".5" fill="currentColor"/></svg>
        </div>
        <p className="eyebrow">CONNECTION</p>
        <h2 className="display" style={{ fontSize: 26, lineHeight: 1.1 }}>You’re offline</h2>
        <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5, maxWidth: 260 }}>Burs needs a connection to style you. Some saved outfits are still available.</p>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={nav.pop}>Saved outfits</button>
          <button className="btn btn-sm" onClick={nav.pop}>Retry</button>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

function ErrorScreen({ message = 'Something went sideways' }) {
  const nav = _useNav();
  return (
    <div className="device theme-light">
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', padding:'40px 28px', gap: 16, textAlign:'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background:'var(--bg-2)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/></svg>
        </div>
        <p className="eyebrow">ERROR</p>
        <h2 className="display" style={{ fontSize: 26, lineHeight: 1.1 }}>{message}</h2>
        <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5, maxWidth: 260 }}>It’s not you. Give it another shot — we logged the trip.</p>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={nav.pop}>Go back</button>
          <button className="btn btn-sm" onClick={nav.pop}>Try again</button>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== LIVE SCAN ===================
// Camera viewfinder with detection overlay + batch capture.
function LiveScanScreen() {
  const nav = _useNav();
  const [shots, setShots] = React.useState([]); // hues for thumbnails
  const [scanning, setScanning] = React.useState(false);
  const [detected, setDetected] = React.useState('Cotton tee · cream');

  // Cycle the detection label so it feels alive
  React.useEffect(() => {
    const samples = ['Cotton tee · cream', 'Wool overshirt · olive', 'Linen trouser · sand', 'Suede loafer · camel', 'Oxford shirt · white'];
    let i = 0;
    const id = setInterval(() => { i = (i+1) % samples.length; setDetected(samples[i]); }, 2200);
    return () => clearInterval(id);
  }, []);

  const capture = () => {
    setScanning(true);
    setTimeout(() => {
      setShots(s => [...s, [32, 200, 18, 75, 220, 280, 350, 120][s.length % 8]]);
      setScanning(false);
    }, 600);
  };

  return (
    <div className="device theme-light">
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column', background:'#0c0c0c', color:'#fff' }}>
        {/* Top bar */}
        <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex: 4 }}>
          <button onClick={nav.pop} style={{ background:'rgba(255,255,255,.08)', border:0, color:'#fff', width: 36, height: 36, borderRadius: 999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon.Close /></button>
          <div style={{ textAlign:'center' }}>
            <p className="eyebrow" style={{ color:'rgba(255,255,255,.7)' }}>LIVE SCAN</p>
            <p style={{ fontFamily:"'Playfair Display', serif", fontStyle:'italic', fontSize: 16, fontWeight: 500, marginTop: 1 }}>{shots.length} captured</p>
          </div>
          <button style={{ background:'rgba(255,255,255,.08)', border:0, color:'#fff', width: 36, height: 36, borderRadius: 999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 7c2-3 5-4 9-4s7 1 9 4"/><path d="M21 5v4h-4"/><circle cx="12" cy="14" r="4"/></svg>
          </button>
        </div>

        {/* Viewfinder */}
        <div style={{ flex: 1, position:'relative', overflow:'hidden' }}>
          {/* Faux camera scene */}
          <div style={{ position:'absolute', inset: 0, background:'radial-gradient(ellipse at 50% 40%, #2a2a2a, #0c0c0c 70%)' }} />
          {/* Faux garment silhouette */}
          <div style={{ position:'absolute', left: '50%', top: '50%', transform:'translate(-50%, -50%)', width: 160, height: 200, background:'linear-gradient(160deg, #4a4540, #2a2722)', borderRadius:'40% 40% 30% 30% / 25% 25% 20% 20%', boxShadow:'0 30px 80px rgba(0,0,0,.6)' }} />

          {/* Corner brackets */}
          {[[20,20,'tl'],[null,20,'tr'],[20,null,'bl'],[null,null,'br']].map(([l, t, k]) => {
            const corners = {
              tl: { left: 20, top: 80,    borderLeft:'2px solid #fff', borderTop:'2px solid #fff' },
              tr: { right: 20, top: 80,   borderRight:'2px solid #fff', borderTop:'2px solid #fff' },
              bl: { left: 20, bottom: 120,borderLeft:'2px solid #fff', borderBottom:'2px solid #fff' },
              br: { right: 20, bottom: 120, borderRight:'2px solid #fff', borderBottom:'2px solid #fff' },
            };
            return <div key={k} style={{ position:'absolute', width: 28, height: 28, borderRadius: 4, ...corners[k], opacity: 0.85 }} />;
          })}

          {/* Detection chip */}
          <div style={{ position:'absolute', left: '50%', top: 90, transform:'translateX(-50%)', background:'rgba(0,0,0,.6)', backdropFilter:'blur(10px)', padding:'8px 14px', borderRadius: 999, display:'flex', alignItems:'center', gap: 8, border:'1px solid rgba(255,255,255,.12)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background:'var(--accent)', boxShadow:'0 0 12px var(--accent)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing:'-0.005em' }}>{detected}</span>
          </div>

          {/* Scan line */}
          {scanning && (
            <div style={{ position:'absolute', left: 20, right: 20, top: '40%', height: 2, background:'linear-gradient(90deg, transparent, var(--accent), transparent)', boxShadow:'0 0 24px var(--accent)', animation:'scanLine 600ms ease-in-out' }} />
          )}

          {/* Hint */}
          <p style={{ position:'absolute', bottom: 20, left: 0, right: 0, textAlign:'center', fontSize: 11, color:'rgba(255,255,255,.65)', textTransform:'uppercase', letterSpacing:'0.18em' }}>Place piece on a flat surface · hold steady</p>
        </div>

        {/* Captured strip */}
        {shots.length > 0 && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,.08)', display:'flex', gap: 6, overflowX:'auto', flexShrink: 0 }}>
            {shots.map((h, i) => (
              <div key={i} style={{ width: 44, height: 56, borderRadius: 8, background: _hueGrad(h), flexShrink: 0, position:'relative' }}>
                <span style={{ position:'absolute', top: 2, left: 2, fontSize: 9, fontWeight: 700, background:'rgba(0,0,0,.6)', borderRadius: 4, padding:'1px 4px' }}>{i+1}</span>
              </div>
            ))}
            <button onClick={() => setShots([])} style={{ flexShrink: 0, width: 44, height: 56, borderRadius: 8, background:'rgba(255,255,255,.06)', border:'1px dashed rgba(255,255,255,.2)', color:'rgba(255,255,255,.6)', fontSize: 10, cursor:'pointer' }}>Clear</button>
          </div>
        )}

        {/* Shutter row */}
        <div style={{ padding:'18px 24px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button style={{ background:'rgba(255,255,255,.08)', border:0, color:'#fff', width: 44, height: 44, borderRadius: 12, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon.Image /></button>
          <button onClick={capture} aria-label="Capture" style={{ width: 72, height: 72, borderRadius: 999, background:'#fff', border:'4px solid rgba(255,255,255,.4)', cursor:'pointer', position:'relative', transition:'transform 120ms ease' }}>
            <span style={{ position:'absolute', inset: 4, borderRadius: 999, background:'#fff' }} />
          </button>
          <button
            onClick={() => shots.length > 0 ? nav.replace({ id: 'add3', props: { batch: shots.length } }) : nav.pop()}
            style={{ background: shots.length > 0 ? 'var(--accent)' : 'rgba(255,255,255,.08)', border:0, color: shots.length > 0 ? 'var(--accent-fg)' : '#fff', minWidth: 60, height: 44, padding:'0 14px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor:'pointer', letterSpacing:'-0.01em' }}>
            {shots.length > 0 ? `Done · ${shots.length}` : 'Cancel'}
          </button>
        </div>
      </div>
      <style>{`@keyframes scanLine { 0% { top: 30%; opacity: 0; } 50% { opacity: 1; } 100% { top: 70%; opacity: 0; } }`}</style>
    </div>
  );
}

// Expose globals
Object.assign(window, {
  OnboardingScreen, PlanMonthScreen,
  LaundryScreen, ShopGapScreen, WishlistScreen,
  PaywallScreen, HelpScreen, DeleteAccountScreen,
  EmptyWardrobeScreen, NoConnectionScreen, ErrorScreen,
  LiveScanScreen,
});

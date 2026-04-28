/* eslint-disable */
const { useState } = React;

// =================== ICONS — editorial, custom set ===================
const Icon = {
  // Home: a house — "Today"
  Home: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.8Z" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0}/>
    </svg>
  ),
  // Wardrobe: hanger
  Wardrobe: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 8.5V11l9 6.5a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 17.5L12 11" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0}/>
      <path d="M12 8.5a2.5 2.5 0 1 1 2.5-2.5" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" fill="none"/>
    </svg>
  ),
  // Plan: calendar
  Plan: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0}/>
      <path d="M3 10h18" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      <circle cx="8" cy="14.5" r="1.1" fill="currentColor"/>
      <circle cx="12" cy="14.5" r="1.1" fill="currentColor"/>
      <circle cx="16" cy="14.5" r="1.1" fill="currentColor" opacity={active ? 1 : 0.5}/>
    </svg>
  ),
  // Insights: bar chart trending up
  Insights: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 21h18" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      <rect x="5" y="13" width="3.4" height="6" rx="0.8" stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.22 : 0}/>
      <rect x="10.3" y="9" width="3.4" height="10" rx="0.8" stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.22 : 0}/>
      <rect x="15.6" y="5" width="3.4" height="14" rx="0.8" stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.22 : 0}/>
    </svg>
  ),
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  Filter: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg>,
  Chevron: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m9 6 6 6-6 6"/></svg>,
  Sun: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  Camera: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/></svg>,
  Image: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>,
  Upload: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8 12 3 7 8"/><path d="M12 3v12"/></svg>,
  Link: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Sparkles: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/></svg>,
  Calendar: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Close: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>,
  Hanger: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8.5V11l9 6.5a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 17.5L12 11"/><path d="M12 8.5a2.5 2.5 0 1 1 2.5-2.5"/></svg>,
  Washer: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="8" cy="6.5" r="0.7" fill="currentColor"/><circle cx="11" cy="6.5" r="0.7" fill="currentColor"/></svg>,
  Chat: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>,
  Outfits: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.4"/><rect x="13" y="3" width="8" height="8" rx="1.4"/><rect x="3" y="13" width="8" height="8" rx="1.4"/><path d="M14 17h7M14 14.5h7M14 19.5h5"/></svg>,
  Tshirt: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4.5 5.5 6 9l2-1v12h8V8l2 1 1.5-3.5L16 3l-2 1.5a3 3 0 0 1-4 0L8 3Z"/></svg>,
  Smile: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0"/><circle cx="9" cy="10" r="0.8" fill="currentColor"/><circle cx="15" cy="10" r="0.8" fill="currentColor"/></svg>,
  Suitcase: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18"/></svg>,
  Gaps: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><path d="M14 17.5h7M17.5 14v7" strokeDasharray="2 2"/></svg>,
  Gear: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>,
};

// =================== STATUS BAR ===================
function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <div className="status-bar-icons">
        <svg viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="0.6"/><rect x="5" y="4" width="3" height="7" rx="0.6"/><rect x="10" y="2" width="3" height="9" rx="0.6"/><rect x="15" y="0" width="3" height="11" rx="0.6"/></svg>
        <svg viewBox="0 0 17 12" width="17" fill="none"><path d="M1 4.5C3.5 2 6 1 8.5 1s5 1 7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M3.5 7C5 5.5 7 5 8.5 5s3.5.5 5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="8.5" cy="10" r="1.2" fill="currentColor"/></svg>
        <svg viewBox="0 0 27 12" width="27" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" opacity="0.5"/><rect x="2" y="2" width="17" height="8" rx="1.2" fill="currentColor"/><rect x="23.5" y="4" width="1.5" height="4" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
      </div>
    </div>
  );
}

// =================== BOTTOM NAV ===================
function BottomNav({ active = 'today' }) {
  const nav = window.useNav ? window.useNav() : null;
  // In the iPhone mockup (no router), override the hardcoded `active` so
  // the highlight follows the screen we're showing.
  if (!nav && typeof window.__phoneActiveTab !== 'undefined' && window.__phoneActiveTab !== '') {
    active = window.__phoneActiveTab;
  }
  // Map tab ids to router screen ids
  const tabToScreen = { today: 'home', wardrobe: 'wardrobe', plan: 'plan', insights: 'insights' };
  const goTab = (tabId) => () => {
    if (nav) {
      nav.goto ? nav.goto(tabToScreen[tabId]) : nav.push(tabToScreen[tabId]);
    } else if (typeof window.__phoneSetScreen === 'function') {
      // Fallback for non-router contexts (e.g. iPhone mockup)
      window.__phoneSetScreen(tabId === 'today' ? 'home' : tabId);
    }
  };
  const goAdd = () => {
    if (nav) nav.push('add');
    else if (typeof window.__phoneSetScreen === 'function') window.__phoneSetScreen('add');
  };

  const tabs = [
    { id: 'today', label: 'Today', icon: Icon.Home },
    { id: 'wardrobe', label: 'Wardrobe', icon: Icon.Wardrobe },
  ];
  const tabsRight = [
    { id: 'plan', label: 'Plan', icon: Icon.Plan },
    { id: 'insights', label: 'Insights', icon: Icon.Insights },
  ];
  return (
    <nav className="floating-nav">
      <div className="floating-nav-pill">
        {tabs.map(t => {
          const Ico = t.icon; const isActive = active === t.id;
          return (
            <button key={t.id} onClick={goTab(t.id)} className={`fnav-tab${isActive ? ' active' : ''}`} aria-label={t.label}>
              <Ico active={isActive} />
              {isActive && <span className="fnav-label">{t.label}</span>}
            </button>
          );
        })}
        <button className="fnav-add" onClick={goAdd} aria-label="Add"><Icon.Plus /></button>
        {tabsRight.map(t => {
          const Ico = t.icon; const isActive = active === t.id;
          return (
            <button key={t.id} onClick={goTab(t.id)} className={`fnav-tab${isActive ? ' active' : ''}`} aria-label={t.label}>
              <Ico active={isActive} />
              {isActive && <span className="fnav-label">{t.label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// =================== PLACEHOLDERS ===================
function Placeholder({ label, h }) {
  return (
    <div style={{ position: 'relative', height: h, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <div className="placeholder-stripe" />
      {label && <div className="placeholder-label">{label}</div>}
    </div>
  );
}
function Thumb({ label }) {
  return (
    <div className="outfit-thumb">
      <div className="placeholder-stripe" />
      {label && <div className="placeholder-label">{label}</div>}
    </div>
  );
}

// =================== HOME — HUB FOR EVERY WIRED ACTION ===================
// Surfaces every button found across the codebase:
//   Floating nav: Today / Wardrobe / (+) / Plan / Insights
//   Today's Look: View, Wear this, Restyle
//   Wardrobe: Garments, Outfits, Laundry, Search, Filter, Grid, (+)
//   Plan: Calendar, Wear today, Restyle, Clear, +Add
//   Add Garment: Live scan, Camera, Gallery, Upload, Import link
//   Insights: stats, wear chart, most-worn
//   Stylist (AI), Discover, Avatar, Weather pill
function HomeScreen({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const go = (id) => () => nav && nav.push(id);
  const goWith = (target) => () => nav && nav.push(target);
  const HubTile = ({ icon, label, sub, accent, onClick }) => (
    <button className="hub-tile" data-accent={accent ? '1' : '0'} onClick={onClick}>
      <div className="hub-tile-icon">{icon}</div>
      <div className="hub-tile-meta">
        <span className="hub-tile-label">{label}</span>
        {sub && <span className="hub-tile-sub">{sub}</span>}
      </div>
    </button>
  );

  const t = theme || (nav && nav.theme) || 'light';

  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div className="scroll-area">
        <div className="scroll-content">
          <header className="page-header">
            <div className="page-title-block">
              <p className="eyebrow">Sat · Apr 26</p>
              <h1 className="page-title">Good morning, Borna</h1>
            </div>
            <div style={{ display:'flex', gap: 8, alignItems:'center', paddingTop: 2 }}>
              <button className="weather-pill" onClick={go('notifications')} style={{ border:0, cursor:'pointer' }}><Icon.Sun /> 14°</button>
              <button className="avatar" aria-label="Profile" onClick={go('profile')}>B</button>
            </div>
          </header>

          <section className="card-hero">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 12 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 3 }}>Today's Look</p>
                <h2 className="display" style={{ fontSize: 22, lineHeight: 1.1, fontWeight: 500 }}>Studio brunch</h2>
              </div>
              <button className="btn-quiet" onClick={go('outfit')} style={{ display:'inline-flex', alignItems:'center', gap: 4, color:'var(--accent)', fontSize: 12, fontWeight: 500, background:'transparent', border: 0, cursor:'pointer' }}>
                View <Icon.Chevron />
              </button>
            </div>
            <div className="outfit-row" style={{ marginBottom: 14 }}>
              <Thumb label="OUTER" /><Thumb label="TOP" /><Thumb label="BOTTOM" /><Thumb label="SHOES" />
            </div>
            <p style={{ fontSize: 12.5, color:'var(--fg-2)', marginBottom: 14, lineHeight: 1.45 }}>14° clear — pair the wool overshirt with cream linen for the gallery opening at 11.</p>
            <div style={{ display:'flex', gap: 8 }}>
              <button className="btn btn-block" style={{ flex: 1 }} onClick={go('outfit')}>Wear this</button>
              <button className="btn btn-outline" onClick={go('styleme')}>Restyle</button>
            </div>
          </section>

          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Your Stylist</p>
            <div className="hub-grid-2">
              <HubTile icon={<Icon.Chat />} label="Style Chat" sub="Ask your AI stylist anything" onClick={go('chat')} />
              <HubTile icon={<Icon.Outfits />} label="Outfits" sub="Your saved looks & combos" onClick={go('outfits')} />
              <HubTile icon={<Icon.Tshirt />} label="Style Me" sub="Get styled for any occasion" onClick={go('styleme')} />
              <HubTile icon={<Icon.Smile />} label="Mood Outfit" sub="Dress how you feel" onClick={go('mood')} />
            </div>
          </section>

          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Discover</p>
            <div className="hub-grid-2">
              <HubTile icon={<Icon.Suitcase />} label="Travel Capsule" sub="Pack smart for any trip" onClick={go('travel')} />
              <HubTile icon={<Icon.Gaps />} label="Wardrobe Gaps" sub="What's missing from your closet" onClick={go('gaps')} />
              <HubTile icon={<Icon.Gear />} label="Settings" sub="Preferences & account" onClick={go('settings')} />
            </div>
          </section>

          <section>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h3 className="section-title">This week</h3>
              <button className="btn-quiet" onClick={go('plan')} style={{ background:'transparent', border:0, color:'var(--accent)', fontSize: 12, fontWeight: 500, cursor:'pointer' }}>Calendar →</button>
            </div>
            <div className="mini-week">
              {[
                ['SAT', 26, true, 'gold'],
                ['SUN', 27, false, 'gold'],
                ['MON', 28, false, 'gold'],
                ['TUE', 29, false, null],
                ['WED', 30, false, 'gold'],
                ['THU', 1, false, null],
                ['FRI', 2, false, null],
              ].map(([d,n,a,dot],i) => (
                <button key={i} className={`mini-day${a ? ' active' : ''}`} onClick={go('plan')}>
                  <span className="dow">{d}</span>
                  <span className="num">{n}</span>
                  <span className="dot" style={{ background: dot==='gold' ? 'var(--accent)' : a ? 'var(--bg)' : 'var(--fg-3)', opacity: dot ? 1 : 0.25 }} />
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap: 6, marginTop: 10 }}>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={go('outfit')}>Wear today</button>
              <button className="btn btn-outline btn-sm" onClick={go('styleme')}>Restyle</button>
              <button className="btn btn-outline btn-sm" onClick={go('add')}>+ Add</button>
            </div>
          </section>

          <section>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h3 className="section-title">Ask the stylist</h3>
              <span className="caption">AI</span>
            </div>
            <button className="stylist-row" onClick={go('chat')} style={{ width:'100%', textAlign:'left', cursor:'pointer' }}>
              <div className="stylist-icon"><Icon.Sparkles /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color:'var(--fg)', letterSpacing:'-0.01em' }}>What goes with my linen trousers?</p>
                <p style={{ fontSize: 11.5, color:'var(--fg-2)', marginTop: 1 }}>Tap to chat — context-aware</p>
              </div>
              <Icon.Chevron />
            </button>
          </section>

          <section>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h3 className="section-title">Your rhythm</h3>
              <button className="btn-quiet" onClick={go('insights')} style={{ background:'transparent', border:0, color:'var(--accent)', fontSize: 12, fontWeight: 500, cursor:'pointer' }}>Insights →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
              <button className="stat-block" onClick={go('insights')} style={{ textAlign:'left', cursor:'pointer' }}>
                <div className="num">23</div><div className="lbl">Outfits worn</div>
              </button>
              <button className="stat-block" onClick={go('insights')} style={{ textAlign:'left', cursor:'pointer' }}>
                <div className="num">68%</div><div className="lbl">Wardrobe used</div>
              </button>
            </div>
          </section>
        </div>
      </div>
      <BottomNav active="today" />
      <div className="home-indicator" />
    </div>
  );
}

// =================== WARDROBE ===================
function WardrobeScreen({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const go = (id) => () => nav && nav.push(id);
  const t = theme || (nav && nav.theme) || 'light';
  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div className="scroll-area">
        <div className="scroll-content">
          {/* Header — title left, (+) right preserved */}
          <header className="page-header">
            <div className="page-title-block">
              <p className="eyebrow">Inventory · 142</p>
              <h1 className="page-title">Your wardrobe</h1>
            </div>
            <button className="icon-btn solid" aria-label="Add" onClick={go('add')}><Icon.Plus /></button>
          </header>

          {/* Tabs */}
          <div style={{ display:'flex', gap: 6, padding: '2px 0' }}>
            <button className="chip active">Garments</button>
            <button className="chip" onClick={go('outfits')}>Outfits</button>
            <button className="chip" onClick={go('laundry')}>Laundry</button>
          </div>

          {/* Search + filter */}
          <div style={{ display:'flex', gap: 8 }}>
            <button className="search-bar" onClick={go('search')} style={{ flex: 1, border: 0, cursor: 'pointer', textAlign: 'left' }}>
              <Icon.Search /><span>Search 142 garments…</span>
            </button>
            <button className="icon-btn" onClick={go('filters')}><Icon.Filter /></button>
            <button className="icon-btn"><Icon.Grid /></button>
          </div>

          {/* Smart access tiles */}
          <div className="smart-tiles">
            <div className="smart-tile"><span className="num">12</span><span className="lbl">Recently added</span></div>
            <div className="smart-tile"><span className="num">38</span><span className="lbl">Most worn</span></div>
            <div className="smart-tile"><span className="num">7</span><span className="lbl">Unworn this season</span></div>
            <button className="smart-tile" onClick={go('laundry')} style={{ border: 0, cursor:'pointer', textAlign:'left', font:'inherit', color:'inherit' }}><span className="num">4</span><span className="lbl">In laundry</span></button>
          </div>

          {/* Wishlist & gaps row */}
          <div className="smart-tiles">
            <button className="smart-tile" onClick={go('wishlist')} style={{ border: 0, cursor:'pointer', textAlign:'left', font:'inherit', color:'inherit' }}><span className="num">4</span><span className="lbl">Wishlist</span></button>
            <button className="smart-tile" onClick={go('gaps')} style={{ border: 0, cursor:'pointer', textAlign:'left', font:'inherit', color:'inherit' }}><span className="num">5</span><span className="lbl">Gaps</span></button>
            <button className="smart-tile" onClick={go('emptyWardrobe')} style={{ border: 0, cursor:'pointer', textAlign:'left', font:'inherit', color:'inherit', opacity: 0.7 }}><span className="num">⌀</span><span className="lbl">Empty state</span></button>
            <button className="smart-tile" onClick={go('noConnection')} style={{ border: 0, cursor:'pointer', textAlign:'left', font:'inherit', color:'inherit', opacity: 0.7 }}><span className="num">!</span><span className="lbl">Offline</span></button>
          </div>

          {/* Category eyebrow */}
          <div className="section-head" style={{ marginTop: 4 }}>
            <p className="eyebrow">All garments</p>
            <span className="caption">A → Z</span>
          </div>

          {/* Grid */}
          <div className="garment-grid">
            {[
              ['Cream tee','Tops · Cotton', 32], ['Navy blazer','Outer · Wool', 215], ['Linen trouser','Bottoms · Linen', 38],
              ['Leather loafer','Shoes · Suede', 28], ['Wool overshirt','Outer · Wool', 32], ['Striped oxford','Tops · Cotton', 200],
              ['Black denim','Bottoms · Denim', 220], ['Cashmere knit','Tops · Cashmere', 18], ['Suede boot','Shoes · Suede', 18],
            ].map((g, i) => (
              <button className="garment-card" key={i} onClick={() => nav && nav.push({ id:'garment', props:{ name: g[0], sub: g[1] }})} style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', textAlign:'left' }}>
                <div style={{ background: `linear-gradient(135deg, hsl(${g[2]} 38% 78%), hsl(${(g[2]+30)%360} 30% 62%))`, aspectRatio:'1', borderRadius:'14px 14px 0 0' }} />
                <div className="meta-row">
                  <span className="name">{g[0]}</span>
                  <span className="sub">{g[1]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <BottomNav active="wardrobe" />
      <div className="home-indicator" />
    </div>
  );
}

// =================== PLAN ===================
function PlanScreen({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const go = (id) => () => nav && nav.push(id);
  const t = theme || (nav && nav.theme) || 'light';
  const days = [
    { dow:'SAT', n:26, dot:'gold', active:true },
    { dow:'SUN', n:27, dot:'gold' },
    { dow:'MON', n:28, dot:'gold' },
    { dow:'TUE', n:29 },
    { dow:'WED', n:30, dot:'gold' },
    { dow:'THU', n:1 },
    { dow:'FRI', n:2 },
  ];
  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div className="scroll-area">
        <div className="scroll-content">
          <header className="page-header">
            <div className="page-title-block">
              <p className="eyebrow">April 2026</p>
              <h1 className="page-title">Your Week</h1>
            </div>
            <button className="icon-btn" onClick={go('planMonth')}><Icon.Calendar /></button>
          </header>

          {/* Week strip */}
          <div className="week-strip">
            {days.map((d,i)=> (
              <div key={i} className={`week-day${d.active ? ' active' : ''}`}>
                <span className="dow">{d.dow}</span>
                <span className="num">{d.n}</span>
                <span className={`dot${d.dot==='gold' ? ' gold' : ''}`} style={{ opacity: d.dot ? 1 : 0.25 }} />
              </div>
            ))}
          </div>

          {/* Planned panel */}
          <section>
            <div style={{ display:'flex', gap: 6, marginBottom: 10, flexWrap:'wrap' }}>
              <span className="eyebrow-chip">Planned · Today</span>
              <span className="eyebrow-chip">Brunch · Soft</span>
            </div>
            <h2 className="display" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 6 }}>Today is styled</h2>
            <p style={{ fontSize: 13, color:'var(--fg-2)', lineHeight: 1.5, marginBottom: 14 }}>
              Cream linen trouser, wool overshirt, and the suede loafers — calibrated for 14° and a long lunch.
            </p>
            <div className="outfit-row" style={{ marginBottom: 14 }}>
              <Thumb label="OUTER" />
              <Thumb label="TOP" />
              <Thumb label="BOTTOM" />
              <Thumb label="SHOES" />
            </div>
            <button className="btn btn-block" style={{ marginBottom: 8 }} onClick={go('outfit')}>Wear today</button>
            <div style={{ display:'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={go('styleme')}>Restyle</button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }}>Clear</button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={go('add')}>+ Add</button>
            </div>
          </section>

          <hr className="hr" />

          {/* Coming up */}
          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Coming up</p>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {[
                ['MON 28','Office · tailored'],
                ['WED 30','Dinner · evening'],
              ].map(([d, l], i) => (
                <button key={i} onClick={go('outfit')} style={{ width:'100%', display:'flex', alignItems:'center', gap: 12, padding:'10px 0', borderBottom: i===0 ? '1px solid var(--border)' : 'none', background: 'transparent', border: 0, cursor: 'pointer', textAlign:'left' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, overflow:'hidden', position:'relative', flexShrink:0 }}>
                    <div className="placeholder-stripe" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="caption" style={{ textTransform:'uppercase', letterSpacing:'0.14em', fontSize: 10, opacity: 0.6 }}>{d}</p>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color:'var(--fg)', letterSpacing:'-0.01em' }}>{l}</p>
                  </div>
                  <Icon.Chevron />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      <BottomNav active="plan" />
      <div className="home-indicator" />
    </div>
  );
}

// =================== INSIGHTS ===================
// Small circular gauge — pure SVG, animates on render
function Gauge({ value, max = 100, unit, label, delta, deltaDir = 'up' }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = 30;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - pct);
  return (
    <div className="gauge-card">
      <div className="gauge">
        <svg viewBox="0 0 72 72">
          <circle className="track" cx="36" cy="36" r={r} fill="none" strokeWidth="6" />
          <circle
            className="fill"
            cx="36" cy="36" r={r} fill="none" strokeWidth="6"
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="center">
          <span className="v">{value}{unit === '%' ? '%' : ''}</span>
          {unit && unit !== '%' ? <span className="u">{unit}</span> : null}
        </div>
      </div>
      <div className="g-label">{label}</div>
      {delta ? <div className={`g-delta${deltaDir === 'down' ? ' down' : ''}`}>{deltaDir === 'up' ? '↑' : '↓'} {delta}</div> : null}
    </div>
  );
}

function InsightsScreen({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const t = theme || (nav && nav.theme) || 'light';
  const bars = [40, 65, 30, 80, 55, 72, 90, 48, 60, 35, 70, 55];
  // Wardrobe palette — what the user actually wears, ordered by share
  const palette = [
    { name: 'Cream',    hex: '#EDE3D2', pct: 28 },
    { name: 'Charcoal', hex: '#2A2622', pct: 22 },
    { name: 'Camel',    hex: '#B98E5A', pct: 16 },
    { name: 'Olive',    hex: '#6B6B3F', pct: 12 },
    { name: 'Slate',    hex: '#7A8089', pct: 10 },
    { name: 'Rust',     hex: '#A85432', pct:  7 },
    { name: 'Other',    hex: '#C9C0AE', pct:  5 },
  ];
  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div className="scroll-area">
        <div className="scroll-content">
          <header className="page-header">
            <div className="page-title-block">
              <p className="eyebrow">Last 30 days</p>
              <h1 className="page-title">Insights</h1>
            </div>
          </header>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
            <div className="stat-block"><div className="num">23</div><div className="lbl">Outfits worn</div></div>
            <div className="stat-block"><div className="num">68%</div><div className="lbl">Wardrobe used</div></div>
          </div>

          {/* Three gauges — at-a-glance health */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8 }}>
            <Gauge value={82} max={100} unit="%" label="Cost / wear efficiency" delta="18%" deltaDir="up" />
            <Gauge value={47} max={100} unit="%" label="Outfit variety" delta="6 new combos" deltaDir="up" />
            <Gauge value={91} max={100} unit="%" label="Care &amp; laundry on time" delta="2 overdue" deltaDir="down" />
          </div>

          {/* Wardrobe color palette */}
          <div className="card">
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

          {/* Wear chart */}
          <div className="card">
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
          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Most worn</p>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {[
                ['Cream linen trouser', '11 wears'],
                ['Wool overshirt', '9 wears'],
                ['White oxford', '7 wears'],
              ].map(([n, w], i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap: 12, padding:'10px 0', borderBottom: i<2 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, overflow:'hidden', position:'relative', flexShrink:0 }}>
                    <div className="placeholder-stripe" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color:'var(--fg)', letterSpacing:'-0.01em' }}>{n}</p>
                    <p className="caption" style={{ fontSize: 11 }}>{w}</p>
                  </div>
                  <span className="display" style={{ fontSize: 18, color:'var(--accent)' }}>{i+1}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Cost-per-wear quote */}
          <div className="card-hero">
            <p className="eyebrow" style={{ marginBottom: 8 }}>Quiet win</p>
            <p className="display" style={{ fontSize: 19, lineHeight: 1.3, color:'var(--fg)' }}>Your cost-per-wear dropped 18% — the cashmere is finally pulling its weight.</p>
          </div>
        </div>
      </div>
      <BottomNav active="insights" />
      <div className="home-indicator" />
    </div>
  );
}

// =================== ADD GARMENT — STEP 1 (Choose source + multi-photo) ===================
function AddGarmentStep1({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const t = theme || (nav && nav.theme) || 'light';
  const next = () => nav && nav.replace('add2');
  const back = () => nav && nav.pop();
  // Mock added photos — represents what the user has staged so far
  const [photos, setPhotos] = React.useState([
    { id: 1, hue: 32 }, { id: 2, hue: 28 }, { id: 3, hue: 200 },
    { id: 4, hue: 18 }, { id: 5, hue: 45 },
  ]);
  const MAX = 50;
  const addPhoto = () => {
    if (photos.length >= MAX) return;
    setPhotos(p => [...p, { id: Date.now(), hue: Math.floor(Math.random()*360) }]);
  };
  const removePhoto = (id) => setPhotos(p => p.filter(x => x.id !== id));
  const pct = (photos.length / MAX) * 100;

  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Page header */}
        <div style={{ padding:'10px 16px 10px', display:'flex', alignItems:'center', gap: 10, borderBottom:'1px solid var(--border)' }}>
          <button className="icon-btn ghost" onClick={back}><Icon.Back /></button>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>New garment</p>
            <h1 className="page-title" style={{ fontSize: 26 }}>Add pieces</h1>
          </div>
          <button className="btn-quiet" style={{ background:'transparent', border:0, fontSize: 13, color:'var(--fg-2)', fontWeight: 500, cursor:'pointer' }} onClick={back}>Cancel</button>
        </div>

        <div style={{ padding:'14px 20px 16px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap: 16 }}>

          {/* Live scan hero — kept as primary single-piece flow */}
          <button className="option-card hero" onClick={() => nav && nav.push('liveScan')} style={{ textAlign:'left', cursor:'pointer' }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 4 }}>Recommended · single piece</p>
              <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing:'-0.02em', marginBottom: 3 }}>Live scan</h3>
              <p style={{ fontSize: 12, color:'var(--fg-2)', lineHeight: 1.4 }}>Place the garment on a flat surface — we’ll auto-crop and tag.</p>
            </div>
            <div className="option-icon"><Icon.Camera /></div>
          </button>

          {/* Photo source row */}
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Or add photos</p>
            <div className="source-row">
              <button className="source-pill" onClick={addPhoto}>
                <span className="sp-icon"><Icon.Camera /></span>
                <span>
                  <div className="sp-label">Camera</div>
                  <div className="sp-sub">Shoot now</div>
                </span>
              </button>
              <button className="source-pill" onClick={addPhoto}>
                <span className="sp-icon"><Icon.Image /></span>
                <span>
                  <div className="sp-label">Gallery</div>
                  <div className="sp-sub">Pick photos</div>
                </span>
              </button>
            </div>
          </div>

          {/* Counter + progress */}
          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            <div className="photo-counter">
              <span className="count">{photos.length}<em>/ {MAX}</em></span>
              <span className="max">Photos staged</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background:'var(--bg-2)', overflow:'hidden' }}>
              <div style={{ width: `${pct}%`, height:'100%', background:'var(--accent)', transition:'width 220ms ease' }} />
            </div>
          </div>

          {/* Photo grid */}
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-tile" style={{
                background: `linear-gradient(135deg, hsl(${p.hue} 38% 78%), hsl(${(p.hue+30)%360} 30% 62%))`
              }}>
                <span className="ph-num">{String(i+1).padStart(2,'0')}</span>
                <button className="ph-x" onClick={() => removePhoto(p.id)} aria-label="Remove">×</button>
              </div>
            ))}
            {photos.length < MAX ? (
              <button className="photo-tile add" onClick={addPhoto}>
                <span style={{ fontSize: 22, lineHeight: 1, color:'var(--accent)', fontWeight: 300 }}>+</span>
                <span>Add</span>
              </button>
            ) : null}
          </div>

          <p className="caption" style={{ textAlign:'center', opacity: 0.7 }}>
            Up to {MAX} photos · Private to your wardrobe
          </p>
        </div>

        {/* Sticky CTA */}
        <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)', background:'color-mix(in oklab, var(--bg) 92%, transparent)', backdropFilter:'blur(10px)', display:'flex', gap: 10, alignItems:'center' }}>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>{photos.length} ready</p>
            <p style={{ fontSize: 11, color:'var(--fg-2)', letterSpacing:'-0.01em' }}>We’ll tag each one automatically</p>
          </div>
          <button className="btn" disabled={photos.length === 0} onClick={next} style={{ opacity: photos.length === 0 ? 0.45 : 1 }}>
            Analyze {photos.length > 1 ? 'all' : 'piece'}
          </button>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== ADD GARMENT — STEP 2 (Analyzing batch) ===================
function AddGarmentStep2({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const t = theme || (nav && nav.theme) || 'light';
  const next = () => nav && nav.replace('add3');
  const total = 5;
  const done = 3;
  const items = [
    { n: 1, label: 'Cream wool overshirt', state: 'done', hue: 32 },
    { n: 2, label: 'Charcoal trouser',    state: 'done', hue: 28 },
    { n: 3, label: 'White oxford',        state: 'done', hue: 200 },
    { n: 4, label: 'Reading colors…',     state: 'now',  hue: 18 },
    { n: 5, label: 'Queued',              state: 'wait', hue: 45 },
  ];
  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 16px 10px', display:'flex', alignItems:'center', gap: 10, borderBottom:'1px solid var(--border)' }}>
          <button className="icon-btn ghost" onClick={() => nav && nav.pop()}><Icon.Close /></button>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>Step 2 of 3</p>
            <h1 className="page-title" style={{ fontSize: 26 }}>Analyzing</h1>
          </div>
          <button className="btn-quiet" style={{ background:'transparent', border:0, fontSize: 13, color:'var(--fg-2)', fontWeight: 500, cursor:'pointer' }} onClick={next}>Skip</button>
        </div>

        <div style={{ padding:'18px 20px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap: 18 }}>
          {/* Big italic counter */}
          <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap: 6 }}>
            <p className="eyebrow">Reading the batch</p>
            <h2 className="display" style={{ fontSize: 32, lineHeight: 1.05 }}>
              <span style={{ color:'var(--accent)' }}>{done}</span>
              <span style={{ color:'var(--fg-3)' }}> / {total}</span>
            </h2>
            <p className="caption">pieces tagged</p>
          </div>

          {/* Progress */}
          <div style={{ height: 4, borderRadius: 2, background:'var(--bg-2)', overflow:'hidden' }}>
            <div style={{ width: `${(done/total)*100}%`, height:'100%', background:'var(--accent)', transition:'width 320ms ease' }} />
          </div>

          {/* Per-item list */}
          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            {items.map((it) => (
              <div key={it.n} style={{
                display:'flex', alignItems:'center', gap: 12,
                padding:'10px 12px', borderRadius: 14,
                border:'1px solid var(--border)',
                background: it.state === 'now' ? 'var(--card)' : 'var(--bg-2)',
                opacity: it.state === 'wait' ? 0.55 : 1,
              }}>
                <div style={{
                  width: 40, height: 52, borderRadius: 8,
                  background: `linear-gradient(135deg, hsl(${it.hue} 38% 78%), hsl(${(it.hue+30)%360} 30% 62%))`,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow" style={{ marginBottom: 2 }}>Piece {String(it.n).padStart(2,'0')}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color:'var(--fg)', letterSpacing:'-0.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.label}</p>
                </div>
                <span style={{ fontSize: 14, color: it.state === 'done' ? 'var(--accent)' : 'var(--fg-3)', flexShrink: 0 }}>
                  {it.state === 'done' ? '✓' : it.state === 'now' ? '···' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)', background:'color-mix(in oklab, var(--bg) 92%, transparent)', backdropFilter:'blur(10px)' }}>
          <button className="btn btn-block" onClick={next}>Review &amp; confirm</button>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== ADD GARMENT — STEP 3 (Confirm batch) ===================
function AddGarmentStep3({ theme }) {
  const nav = window.useNav ? window.useNav() : null;
  const t = theme || (nav && nav.theme) || 'light';
  const goHome = () => nav && nav.replace('home');
  const [active, setActive] = React.useState(0);
  const pieces = [
    { hue: 32, title: 'Cream wool overshirt', cat: 'Outerwear · Overshirt', color: 'Cream',    material: 'Wool blend',  fit: 'Regular',  seasons: ['Spring','Autumn'] },
    { hue: 28, title: 'Charcoal trouser',     cat: 'Bottoms · Trouser',    color: 'Charcoal', material: 'Wool',        fit: 'Tailored', seasons: ['Autumn','Winter'] },
    { hue: 200,title: 'White oxford shirt',   cat: 'Tops · Shirt',         color: 'White',    material: 'Cotton poplin',fit: 'Regular',  seasons: ['Spring','Summer','Autumn'] },
    { hue: 18, title: 'Rust crewneck',        cat: 'Tops · Knit',          color: 'Rust',     material: 'Merino wool', fit: 'Relaxed',  seasons: ['Autumn','Winter'] },
    { hue: 45, title: 'Camel loafers',        cat: 'Shoes · Loafer',       color: 'Camel',    material: 'Suede',       fit: '—',        seasons: ['Spring','Autumn'] },
  ];
  const p = pieces[active];

  return (
    <div className={`device theme-${t}`}>
      <StatusBar />
      <div style={{ position:'absolute', inset:'47px 0 0 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 16px 10px', display:'flex', alignItems:'center', gap: 10, borderBottom:'1px solid var(--border)' }}>
          <button className="icon-btn ghost" onClick={() => nav && nav.pop()}><Icon.Back /></button>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>Step 3 of 3</p>
            <h1 className="page-title" style={{ fontSize: 26 }}>Confirm batch</h1>
          </div>
          <button className="btn-quiet" style={{ background:'transparent', border:0, fontSize: 13, color:'var(--accent)', fontWeight: 500, cursor:'pointer' }}>Re-scan</button>
        </div>

        {/* Piece selector strip */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', overflowX:'auto', display:'flex', gap: 6, flexShrink: 0 }}>
          {pieces.map((pp, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: 44, height: 56, borderRadius: 10, flexShrink: 0,
                border: i === active ? '2px solid var(--accent)' : '1px solid var(--border)',
                padding: 0, cursor:'pointer',
                background: `linear-gradient(135deg, hsl(${pp.hue} 38% 78%), hsl(${(pp.hue+30)%360} 30% 62%))`,
                position:'relative',
              }}>
              <span style={{ position:'absolute', top: 3, left: 4, fontSize: 9, fontWeight: 700, color:'var(--bg)', background:'color-mix(in oklab, var(--fg) 75%, transparent)', padding:'1px 5px', borderRadius: 999 }}>{String(i+1).padStart(2,'0')}</span>
            </button>
          ))}
        </div>

        <div style={{ padding:'14px 20px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap: 14 }}>
          {/* Hero */}
          <div style={{ display:'flex', gap: 12, alignItems:'flex-start' }}>
            <div style={{ width: 100, height: 130, borderRadius: 16, border:'1px solid var(--border)', flexShrink: 0,
              background: `linear-gradient(135deg, hsl(${p.hue} 38% 78%), hsl(${(p.hue+30)%360} 30% 62%))` }} />
            <div style={{ flex: 1, paddingTop: 4 }}>
              <p className="eyebrow" style={{ marginBottom: 4 }}>Detected</p>
              <h2 className="display" style={{ fontSize: 22, lineHeight: 1.15 }}>{p.title}</h2>
              <div style={{ display:'flex', flexWrap:'wrap', gap: 4, marginTop: 10 }}>
                <span className="chip">{p.cat.split(' · ')[0]}</span>
                <span className="chip">{p.color}</span>
                <span className="chip">{p.material.split(' ')[0]}</span>
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            {[
              ['Title', p.title],
              ['Category', p.cat],
              ['Primary color', p.color],
              ['Material', p.material],
              ['Fit', p.fit],
            ].map(([l, v], i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', border:'1px solid var(--border)', borderRadius: 14, background:'var(--card)' }}>
                <span className="caption" style={{ textTransform:'uppercase', letterSpacing:'0.14em', fontSize: 10 }}>{l}</span>
                <span style={{ fontSize: 13, color:'var(--fg)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Seasons */}
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Seasons</p>
            <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
              {['Spring','Summer','Autumn','Winter'].map((s) => (
                <span key={s} className={`chip${p.seasons.includes(s) ? ' active' : ''}`}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky save bar */}
        <div style={{ padding:'12px 20px 14px', borderTop:'1px solid var(--border)', background:'color-mix(in oklab, var(--bg) 92%, transparent)', backdropFilter:'blur(10px)', display:'flex', gap: 10, alignItems:'center' }}>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>{pieces.length} pieces</p>
            <p style={{ fontSize: 11, color:'var(--fg-2)', letterSpacing:'-0.01em' }}>Edit any before saving</p>
          </div>
          <button className="btn" onClick={goHome}>Save all</button>
        </div>
      </div>
      <div className="home-indicator" />
    </div>
  );
}

// =================== APP ===================
function App() {
  return (
    <DesignCanvas title="BURS — Native Redesign" subtitle="Light + dark only · Warm gold accent · iOS-native motion">
      <DCSection id="main" title="Main screens" subtitle="Home · Wardrobe · Plan · Insights — same button placement, native feel">
        <DCArtboard id="home" label="01 — Home" width={390} height={844}><HomeScreen /></DCArtboard>
        <DCArtboard id="wardrobe" label="02 — Wardrobe" width={390} height={844}><WardrobeScreen /></DCArtboard>
        <DCArtboard id="plan" label="03 — Plan" width={390} height={844}><PlanScreen /></DCArtboard>
        <DCArtboard id="insights" label="04 — Insights" width={390} height={844}><InsightsScreen /></DCArtboard>
      </DCSection>

      <DCSection id="nav" title="Navigation" subtitle="Bottom tab bar — same order: Today · Wardrobe · (+) · Plan · Insights">
        <DCArtboard id="nav-light" label="Tab bar — Light" width={390} height={120}>
          <div className="device theme-light" style={{ height: 120, borderRadius: 22 }}>
            <BottomNav active="today" />
          </div>
        </DCArtboard>
        <DCArtboard id="nav-dark" label="Tab bar — Dark" width={390} height={120}>
          <div className="device theme-dark" style={{ height: 120, borderRadius: 22 }}>
            <BottomNav active="wardrobe" />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="add" title="Add garment flow" subtitle="3-step flow — choose source → AI analyzing → confirm details">
        <DCArtboard id="add-1" label="Step 1 — Choose" width={390} height={844}><AddGarmentStep1 /></DCArtboard>
        <DCArtboard id="add-2" label="Step 2 — Analyzing" width={390} height={844}><AddGarmentStep2 /></DCArtboard>
        <DCArtboard id="add-3" label="Step 3 — Confirm" width={390} height={844}><AddGarmentStep3 /></DCArtboard>
      </DCSection>

      <DCSection id="dark" title="Dark mode" subtitle="Same screens, deep-charcoal surface, warm-gold accent unchanged">
        <DCArtboard id="home-dark" label="Home — Dark" width={390} height={844}><HomeScreen theme="dark" /></DCArtboard>
        <DCArtboard id="wardrobe-dark" label="Wardrobe — Dark" width={390} height={844}><WardrobeScreen theme="dark" /></DCArtboard>
        <DCArtboard id="plan-dark" label="Plan — Dark" width={390} height={844}><PlanScreen theme="dark" /></DCArtboard>
        <DCArtboard id="add-dark" label="Add — Dark" width={390} height={844}><AddGarmentStep1 theme="dark" /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

// Expose components for cross-file usage in iPhone mockup
Object.assign(window, {
  HomeScreen, WardrobeScreen, PlanScreen, InsightsScreen, Gauge,
  AddGarmentStep1, AddGarmentStep2, AddGarmentStep3,
  BottomNav, StatusBar, Icon, App,
});

// Only auto-mount if a #root exists AND no #phones-row (i.e. design canvas page)
if (document.getElementById('root') && !document.getElementById('phones-row')) {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

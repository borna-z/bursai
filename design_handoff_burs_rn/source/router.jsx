/* iOS-style push/pop router with light/dark theme + global state.
   Wraps the whole prototype. Each "screen" is a function returning JSX.
   Use:
     const { push, pop, replace, theme, toggleTheme } = useNav();
     push('settings')              // string id (lookup in registry)
     push({ id: 'garment', props: { id: 42 } })
     pop()
*/

const NavCtx = React.createContext(null);
const useNav = () => React.useContext(NavCtx);
window.useNav = useNav;

function Router({ initial = 'home', registry, theme: initialTheme = 'light' }) {
  const [stack, setStack] = React.useState([{ id: initial, key: 0, props: {} }]);
  const [theme, setTheme] = React.useState(initialTheme);
  const [popping, setPopping] = React.useState(false);
  const keyRef = React.useRef(1);

  // Sync external theme prop changes (e.g. iPhone Mockup top toolbar)
  React.useEffect(() => { setTheme(initialTheme); }, [initialTheme]);

  // Sync external initial screen changes (e.g. iPhone Mockup top toolbar)
  React.useEffect(() => {
    setStack([{ id: initial, key: keyRef.current++, props: {} }]);
  }, [initial]);

  const push = React.useCallback((target) => {
    const entry = typeof target === 'string'
      ? { id: target, key: keyRef.current++, props: {} }
      : { id: target.id, key: keyRef.current++, props: target.props || {} };
    setStack(s => [...s, entry]);
  }, []);

  const pop = React.useCallback(() => {
    setStack(s => {
      if (s.length <= 1) return s;
      setPopping(true);
      // animate, then drop
      setTimeout(() => { setStack(curr => curr.slice(0, -1)); setPopping(false); }, 280);
      return s;
    });
  }, []);

  const replace = React.useCallback((target) => {
    const entry = typeof target === 'string'
      ? { id: target, key: keyRef.current++, props: {} }
      : { id: target.id, key: keyRef.current++, props: target.props || {} };
    setStack([entry]);
  }, []);

  const goto = React.useCallback((target) => {
    // jump from bottom-nav: replace if same root nav, else push
    const tabs = ['home', 'wardrobe', 'plan', 'insights'];
    const id = typeof target === 'string' ? target : target.id;
    if (tabs.includes(id) && tabs.includes(stack[stack.length - 1].id)) {
      replace(target);
    } else if (tabs.includes(id)) {
      // pop everything to home, then go
      const entry = typeof target === 'string'
        ? { id: target, key: keyRef.current++, props: {} }
        : { id: target.id, key: keyRef.current++, props: target.props || {} };
      setStack([entry]);
    } else {
      push(target);
    }
  }, [push, replace, stack]);

  const toggleTheme = React.useCallback(() => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  }, []);

  const value = { push, pop, replace, goto, theme, toggleTheme, stack };

  // Render the current screen, with the previous one fading underneath during pop.
  const top = stack[stack.length - 1];
  const Screen = registry[top.id];
  const prev = stack.length > 1 ? stack[stack.length - 2] : null;
  const PrevScreen = prev ? registry[prev.id] : null;

  return (
    <NavCtx.Provider value={value}>
      <div className={`router-stage theme-${theme}`}>
        {PrevScreen && (
          <div className="router-layer router-prev" key={'prev-' + prev.key}>
            <PrevScreen {...prev.props} />
          </div>
        )}
        <div
          className={`router-layer router-top${stack.length > 1 ? ' is-pushed' : ''}${popping ? ' is-popping' : ''}`}
          key={top.key}
        >
          {Screen ? <Screen {...top.props} /> : <MissingScreen id={top.id} />}
        </div>
      </div>
    </NavCtx.Provider>
  );
}

function MissingScreen({ id }) {
  const { pop } = useNav();
  return (
    <div className="device theme-light" style={{ display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', inset:'47px 0 0 0', padding: 24, display:'flex', flexDirection:'column', gap: 12 }}>
        <button onClick={pop} style={{ background:'transparent', border:0, color:'var(--accent)', fontSize: 14, alignSelf:'flex-start', cursor:'pointer' }}>← Back</button>
        <h1 className="page-title">Coming soon</h1>
        <p style={{ color:'var(--fg-2)' }}>Screen "{id}" not yet wired.</p>
      </div>
    </div>
  );
}

window.Router = Router;
window.MissingScreen = MissingScreen;

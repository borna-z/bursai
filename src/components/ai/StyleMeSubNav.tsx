import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { label: 'Generate', path: '/ai/generate' },
  { label: 'Chat', path: '/ai/chat' },
  { label: 'Mood', path: '/ai/mood' },
  { label: 'Travel', path: '/ai/travel' },
];

export function StyleMeSubNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname;

  return (
    <div style={{ display: 'flex', width: '100%', flexShrink: 0 }}>
      {TABS.map((tab) => {
        const isActive =
          current === tab.path ||
          (tab.path === '/ai/generate' && (current === '/ai' || current === '/ai/generate'));
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 0,
              border: 'none',
              background: isActive ? '#1C1917' : '#EDE8DF',
              color: isActive ? '#F5F0E8' : 'rgba(28,25,23,0.55)',
              fontFamily: 'DM Sans, ui-sans-serif, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

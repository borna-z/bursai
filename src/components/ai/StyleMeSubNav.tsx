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
    <div className="flex w-full shrink-0">
      {TABS.map((tab) => {
        const isActive =
          current === tab.path ||
          (tab.path === '/ai/generate' && (current === '/ai' || current === '/ai/generate'));
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex-1 h-11 rounded-none border-none font-['DM_Sans'] text-xs font-medium cursor-pointer p-0 ${
              isActive
                ? 'bg-foreground text-background'
                : 'bg-card text-foreground/[0.55]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

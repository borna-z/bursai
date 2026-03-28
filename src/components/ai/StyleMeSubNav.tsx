import { useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';

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
  const isGenerateRoute = current === '/ai' || current === '/ai/generate' || current === '/outfits/generate';
  const preservedSearch = isGenerateRoute || current === '/ai/chat'
    ? location.search
    : '';

  return (
    <div className="w-full shrink-0 border-b border-border/55 px-4 pb-3 pt-4">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((tab) => {
          const isActive =
            current === tab.path ||
            (tab.path === '/ai/generate' && isGenerateRoute);
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(
                tab.path === '/ai/generate' || tab.path === '/ai/chat'
                  ? `${tab.path}${preservedSearch}`
                  : tab.path,
              )}
              className={cn(
                'press rounded-[1rem] border px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background shadow-[0_10px_24px_rgba(28,25,23,0.12)]'
                  : 'border-border/70 bg-background/85 text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

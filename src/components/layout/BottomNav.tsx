import { Home, Shirt, Sparkles, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', label: 'Idag', icon: Home },
  { path: '/wardrobe', label: 'Garderob', icon: Shirt },
  { path: '/outfits', label: 'Outfits', icon: Sparkles },
  { path: '/insights', label: 'Insikter', icon: BarChart3 },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-full h-full gap-1 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <tab.icon
                  className={cn(
                    'w-5 h-5 transition-transform',
                    isActive && 'scale-110'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="font-medium">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

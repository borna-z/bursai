import { Home, Shirt, CalendarDays, BarChart3, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', label: 'Idag', icon: Home },
  { path: '/wardrobe', label: 'Garderob', icon: Shirt },
  { path: '/plan', label: 'Plan', icon: CalendarDays },
  { path: '/insights', label: 'Insikter', icon: BarChart3 },
  { path: '/settings', label: 'Inställningar', icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                  isActive && 'bg-primary/10'
                )}>
                  <tab.icon
                    className={cn('w-5 h-5 transition-all', isActive && 'scale-105')}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

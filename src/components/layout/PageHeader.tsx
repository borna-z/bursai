import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageHeader({ 
  title, 
  subtitle,
  showBack = false, 
  actions, 
  className,
  sticky = true 
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header 
      className={cn(
        'bg-background/95 backdrop-blur-sm border-b z-20',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className={cn(
        'flex items-center justify-between px-4 max-w-lg mx-auto',
        subtitle ? 'h-16 py-2' : 'h-14'
      )}>
        <div className="flex items-center gap-3">
          {showBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0 -ml-2 rtl:-ml-0 rtl:-mr-2 rtl:rotate-180"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

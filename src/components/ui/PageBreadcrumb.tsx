import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className="px-4 pt-3">
      <ol className="flex items-center gap-1.5 list-none m-0 p-0">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
              )}
              {isLast || !item.href ? (
                <span className="text-[11px] font-medium font-['DM_Sans'] text-foreground truncate max-w-[200px]">
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-[11px] font-['DM_Sans'] text-muted-foreground/50 hover:text-muted-foreground transition-colors whitespace-nowrap"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

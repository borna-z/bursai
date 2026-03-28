import type { ElementType } from 'react';

import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface RelatedTool {
  title: string;
  description: string;
  to: string;
  icon: ElementType;
  accentClassName?: string;
}

interface InsightsRelatedToolsProps {
  tools: RelatedTool[];
}

export function InsightsRelatedTools({ tools }: InsightsRelatedToolsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tools.map((tool) => {
        const Icon = tool.icon;

        return (
          <Link
            key={tool.to}
            to={tool.to}
            className="surface-interactive group flex min-h-[140px] flex-col justify-between p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-[1rem] bg-background/65 text-foreground/75',
                  tool.accentClassName,
                )}
              >
                <Icon className="size-5" />
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground/45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-[1rem] font-semibold tracking-[-0.03em] text-foreground">
                {tool.title}
              </h3>
              <p className="text-[0.86rem] leading-6 text-muted-foreground">
                {tool.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

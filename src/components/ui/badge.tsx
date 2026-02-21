import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80 dark:bg-white/[0.1] dark:text-white/80 dark:border-white/[0.08]",
        secondary: "border-transparent bg-secondary/60 backdrop-blur-sm text-secondary-foreground hover:bg-secondary/80 dark:bg-white/[0.06] dark:text-white/60 dark:border-white/[0.06]",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "bg-background/40 backdrop-blur-sm text-foreground dark:bg-transparent dark:border-white/[0.1] dark:text-white/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

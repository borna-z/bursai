import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-[#030305] dark:hover:bg-white/90 dark:rounded-full dark:font-semibold",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30 dark:border dark:border-red-500/20",
        outline: "border border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/70 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:backdrop-blur-sm dark:text-white/80 dark:hover:bg-white/[0.08]",
        secondary: "bg-secondary/60 backdrop-blur-sm text-secondary-foreground hover:bg-secondary/80 dark:bg-white/[0.06] dark:backdrop-blur-sm dark:text-white/70 dark:hover:bg-white/[0.1]",
        ghost: "hover:bg-foreground/[0.04] hover:backdrop-blur-sm hover:text-foreground dark:hover:bg-white/[0.06] dark:text-white/60 dark:hover:text-white/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-lg px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

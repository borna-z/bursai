import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(28,25,23,0.12)] hover:bg-primary/94",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border/55 bg-background/82 text-foreground shadow-none hover:bg-background",
        secondary: "bg-secondary/70 text-secondary-foreground shadow-none hover:bg-secondary/82",
        ghost: "text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        editorial: "border border-border/55 bg-card/84 text-foreground shadow-[0_10px_22px_rgba(28,25,23,0.035)] hover:bg-card",
        quiet: "bg-transparent text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
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

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };

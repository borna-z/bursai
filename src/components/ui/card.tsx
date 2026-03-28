import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "text-card-foreground transition-[border-color,background-color,box-shadow] duration-200",
  {
    variants: {
      surface: {
        default: "rounded-[1.75rem] border border-border/70 bg-card shadow-[0_12px_30px_rgba(28,25,23,0.05)]",
        hero: "surface-hero rounded-[2rem]",
        editorial: "surface-editorial rounded-[2rem]",
        utility: "surface-utility rounded-[1.5rem]",
        inset: "surface-inset rounded-[1.35rem]",
        plain: "rounded-none border-transparent bg-transparent shadow-none",
      },
      tone: {
        default: "",
        premium: "border-premium/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(232,220,202,0.78))]",
        accent: "border-accent/15 bg-accent/5",
        inverse: "border-foreground/5 bg-foreground text-background shadow-[0_16px_34px_rgba(15,13,12,0.18)]",
      },
      density: {
        compact: "rounded-[1.35rem]",
        comfortable: "",
        airy: "rounded-[2rem]",
      },
    },
    defaultVariants: {
      surface: "default",
      tone: "default",
      density: "comfortable",
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, surface, tone, density, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ surface, tone, density }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

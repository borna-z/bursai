import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position="top-center"
      duration={2000}
      // Push toasts below the dynamic island / notch.
      // --safe-area-top is the JS-probed safe inset (works on Median iOS where env() returns 0).
      offset="calc(var(--safe-area-top) + 12px)"
      className="toaster group"
      style={{ zIndex: 'var(--z-toast)' } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-[1.25rem] group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-sm",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--success))]",
          error: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--destructive))]",
        },
      }}
      {...props}
    />
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { Toaster, toast };

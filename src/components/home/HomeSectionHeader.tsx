interface HomeSectionHeaderProps {
  label: string;
}

export function HomeSectionHeader({ label }: HomeSectionHeaderProps) {
  return (
    <div
      className="px-[var(--page-px)] pb-3 text-foreground/30"
      style={{
        fontSize: 10,
        fontFamily: "-apple-system, 'SF Pro Text', 'DM Sans', sans-serif",
        textTransform: 'uppercase' as const,
        letterSpacing: '1.8px',
      }}
    >
      {label}
    </div>
  );
}

type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="16"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2.5"
      />
      <rect x="15" y="15" width="10" height="10" rx="3" fill="var(--foreground)" />
      <rect x="27" y="15" width="10" height="10" rx="3" fill="var(--primary)" />
      <rect x="39" y="15" width="10" height="10" rx="3" fill="var(--muted)" />
      <rect x="15" y="27" width="10" height="10" rx="3" fill="var(--border)" />
      <rect x="27" y="27" width="10" height="10" rx="3" fill="var(--foreground)" />
      <rect x="39" y="27" width="10" height="10" rx="3" fill="var(--primary)" />
      <rect x="15" y="39" width="10" height="10" rx="3" fill="var(--muted)" />
      <rect x="27" y="39" width="10" height="10" rx="3" fill="var(--border)" />
      <rect x="39" y="39" width="10" height="10" rx="3" fill="var(--foreground)" />
      <path
        d="M17 39l8 8 22-24"
        stroke="#f59e0b"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLogo({
  className,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <span className={className ? `inline-flex items-center gap-3 ${className}` : "inline-flex items-center gap-3"}>
      <BrandMark className="h-9 w-9 shrink-0" />
      {showWordmark && (
        <span className="inline-flex items-baseline leading-none">
          <span className="font-heading text-lg sm:text-xl font-semibold tracking-[-0.045em] text-foreground transition-colors duration-200 group-hover:text-primary">
            HackJudge
          </span>
        </span>
      )}
    </span>
  );
}

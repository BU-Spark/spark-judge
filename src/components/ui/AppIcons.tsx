import type { SVGProps } from "react";

type AppIconProps = SVGProps<SVGSVGElement>;

const DEFAULT_ICON_SIZE = "h-5 w-5";

function withDefaultSize(className?: string) {
  return className ? `${DEFAULT_ICON_SIZE} ${className}` : DEFAULT_ICON_SIZE;
}

export function TrophyIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2" />
    </svg>
  );
}

export function MedalIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="8" r="5" />
      <path d="m8.5 13 3.5 8 3.5-8" />
      <path d="M10.5 8h3" />
    </svg>
  );
}

export function WarningTriangleIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function LightbulbIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2a6.5 6.5 0 0 0-3.5 12V16h7v-2A6.5 6.5 0 0 0 12 2Z" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

export function CalendarIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function BarChartIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="M8 18v-4" />
      <path d="M12 18v-7" />
      <path d="M16 18V8" />
    </svg>
  );
}

export function SearchIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={withDefaultSize(className)}
      aria-hidden="true"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

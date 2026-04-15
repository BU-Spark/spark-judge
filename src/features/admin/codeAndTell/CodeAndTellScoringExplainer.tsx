import { CODE_AND_TELL_MAX_RANKS } from "../../../lib/codeAndTellConstants";

import { InfoIcon } from "../../../components/ui/AppIcons";

export const CODE_AND_TELL_RANK_HEADERS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
] as const;

export function CodeAndTellScoringExplainer({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`group relative inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}>
      <InfoIcon className="h-4 w-4" />
      <span className="cursor-help underline decoration-dashed underline-offset-2">
        How points are calculated
      </span>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground shadow-md text-center">
          Voters rank up to {CODE_AND_TELL_MAX_RANKS} projects. 1st choice gets {CODE_AND_TELL_MAX_RANKS} points, down to 1 point for {CODE_AND_TELL_MAX_RANKS}th. Ties are broken by most 1st-place votes, then 2nd-place, etc.
        </div>
      </div>
    </div>
  );
}

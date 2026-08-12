import { useEffect, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MedalIcon, TrophyIcon } from "../../../components/ui/AppIcons";
import { toast } from "sonner";
import {
  CODE_AND_TELL_RANK_HEADERS,
  CodeAndTellScoringExplainer,
} from "../codeAndTell/CodeAndTellScoringExplainer";

type StandingRow = {
  teamId: Id<"teams">;
  name: string;
  description: string;
  projectUrl?: string;
  points: number;
  ballotsCount: number;
  rankCounts: number[];
};

export function CodeAndTellWinnerPanel({
  eventId,
  standings,
  defaultWinnerId,
  selectedWinnerId,
  totalBallots,
  onClose,
  onSubmit,
}: {
  eventId: Id<"events">;
  standings: StandingRow[];
  defaultWinnerId?: Id<"teams"> | null;
  selectedWinnerId?: Id<"teams"> | null;
  totalBallots: number;
  onClose: () => void;
  onSubmit: (args: {
    eventId: Id<"events">;
    winnerTeamId: Id<"teams">;
  }) => Promise<unknown>;
}) {
  const [winnerTeamId, setWinnerTeamId] = useState<Id<"teams"> | "">("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setWinnerTeamId(
      (selectedWinnerId || defaultWinnerId || "") as Id<"teams"> | ""
    );
  }, [defaultWinnerId, selectedWinnerId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!winnerTeamId) {
      toast.error("Select a final winner before saving");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ eventId, winnerTeamId });
      toast.success("Winner saved");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save winner");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-border fi-surface shadow-sm">
      <div className="border-b border-border p-6">
        <h3 className="text-2xl fi-zone font-bold fi-ink flex items-center gap-2">
          <TrophyIcon className="h-6 w-6 text-amber-500" />
          Final Winner
        </h3>
        <p className="mt-1 text-sm fi-muted">
          Ranked-vote totals are shown below. Admins can accept the default
          winner or override it before results are released.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-muted/30 px-4 py-3 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <span className="fi-muted">Default Winner:</span>
            <span className="font-semibold fi-ink">
              {standings.find((row) => row.teamId === defaultWinnerId)?.name || "None yet"}
            </span>
          </div>
          <div className="w-px h-4 bg-border hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="fi-muted">Selected Winner:</span>
            <span className="font-semibold fi-ink">
              {standings.find((row) => row.teamId === winnerTeamId)?.name || "No selection"}
            </span>
          </div>
          <div className="w-px h-4 bg-border hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="fi-muted">Submitted Ballots:</span>
            <span className="font-semibold fi-ink">{totalBallots}</span>
          </div>
        </div>

        {standings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm fi-muted">
            No valid ballots have been submitted yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <CodeAndTellScoringExplainer />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border fi-surface">
              <table className="min-w-[52rem] w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/20 text-xs font-bold uppercase tracking-wide fi-muted">
                  <tr>
                    <th className="px-3 py-3 whitespace-nowrap">Rank</th>
                    <th className="px-3 py-3 min-w-[10rem]">Project</th>
                    <th className="px-3 py-3 whitespace-nowrap">Points</th>
                    <th className="px-3 py-3 whitespace-nowrap">Ballots</th>
                    {CODE_AND_TELL_RANK_HEADERS.map((label) => (
                      <th
                        key={label}
                        className="px-2 py-3 text-center whitespace-nowrap"
                      >
                        {label}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center whitespace-nowrap">
                      Winner
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {standings.map((row, index) => (
                    <tr
                      key={row.teamId}
                      className={
                        winnerTeamId === row.teamId
                          ? "bg-amber-500/10"
                          : "hover:bg-muted/20"
                      }
                    >
                      <td className="px-3 py-3 align-middle">
                        <label className="flex cursor-pointer items-center gap-2 font-semibold fi-ink">
                          <span>#{index + 1}</span>
                          {index < 3 && (
                            <MedalIcon className="h-4 w-4 text-amber-500" />
                          )}
                        </label>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <label className="block min-w-0 cursor-pointer">
                          <div className="truncate font-semibold fi-ink">
                            {row.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs fi-muted">
                            {row.description || "No description"}
                          </div>
                        </label>
                      </td>
                      <td className="px-3 py-3 align-middle font-semibold fi-ink">
                        {row.points}
                      </td>
                      <td className="px-3 py-3 align-middle fi-muted">
                        {row.ballotsCount}
                      </td>
                      {CODE_AND_TELL_RANK_HEADERS.map((_, rankIndex) => (
                        <td
                          key={rankIndex}
                          className="px-2 py-3 text-center align-middle fi-muted"
                        >
                          {row.rankCounts[rankIndex] ?? 0}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center align-middle">
                        <input
                          type="radio"
                          name="winner"
                          value={row.teamId}
                          checked={winnerTeamId === row.teamId}
                          onChange={() => setWinnerTeamId(row.teamId)}
                          className="h-4 w-4 border-border text-primary focus:ring-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-4 border-t border-border pt-4">
          <button
            type="submit"
            disabled={submitting || standings.length === 0}
            className="flex-1 fi-transport disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Winner"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 fi-key"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

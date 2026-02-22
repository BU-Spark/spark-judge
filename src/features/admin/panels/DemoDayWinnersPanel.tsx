import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MedalIcon, TrophyIcon } from "../../../components/ui/AppIcons";

export function DemoDayWinnersPanel({
  eventId,
  teams,
  categories,
  onClose,
  onSubmit,
}: {
  eventId: Id<"events">;
  teams: Array<any>;
  categories: string[];
  onClose: () => void;
  onSubmit: (args: {
    eventId: Id<"events">;
    overallWinner: Id<"teams">;
    categoryWinners: Array<{
      category: string;
      teamId: Id<"teams">;
    }>;
  }) => Promise<any>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [overallWinner, setOverallWinner] = useState<Id<"teams"> | "">("");
  const [categoryWinners, setCategoryWinners] = useState<Record<string, Id<"teams"> | "">>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overallWinner) {
      toast.error("Please select an overall winner");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        eventId,
        overallWinner,
        categoryWinners: Object.entries(categoryWinners)
          .filter(([_, teamId]) => teamId)
          .map(([category, teamId]) => ({ category, teamId: teamId as Id<"teams"> })),
      });
      toast.success("Winners selected successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to select winners");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="relative w-full rounded-xl border border-border bg-background shadow-sm">
        <div className="border-b border-border p-6">
          <h3 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Select Winners
          </h3>
          <p className="text-muted-foreground mt-1">
            Choose the overall winner and category winners
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="card p-6 bg-amber-500/10 border-amber-500/20">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <TrophyIcon className="h-6 w-6 text-amber-500" />
              Overall Winner
            </label>
            <select
              required
              value={overallWinner}
              onChange={(e) => setOverallWinner(e.target.value as Id<"teams">)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <MedalIcon className="h-5 w-5 text-amber-500" />
              Category Winners
            </h4>
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category} className="card p-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {category}
                  </label>
                  <select
                    value={categoryWinners[category] || ""}
                    onChange={(e) =>
                      setCategoryWinners({
                        ...categoryWinners,
                        [category]: e.target.value as Id<"teams">,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4 flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Winners"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

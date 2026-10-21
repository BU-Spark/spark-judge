import { useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
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
  const initialWinner = selectedWinnerId || defaultWinnerId || "";
  const [winnerTeamId, setWinnerTeamId] = useState<Id<"teams"> | "">(
    initialWinner,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (
      !submitting &&
      (winnerTeamId === initialWinner ||
        window.confirm("Discard unsaved winner selection?"))
    )
      onClose();
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!winnerTeamId) {
      setError("Select a final winner before saving.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ eventId, winnerTeamId });
      toast.success("Winner saved. Review it before publishing.");
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save the winner. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <form
      className="admin-winner-editor"
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <header className="admin-results-heading">
        <div>
          <h2>Choose the final winner</h2>
          <p>
            {totalBallots} valid ballots. Review the Borda standings and choose
            a project.
          </p>
        </div>
        <button
          type="button"
          className="fi-key"
          onClick={close}
          disabled={submitting}
        >
          Back to results
        </button>
      </header>
      {error && (
        <p className="admin-result-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-results-actions">
        <p className="fi-muted">
          {selectedWinnerId
            ? "Your saved winner is selected below."
            : "The leading project is selected as a suggestion. Save to confirm your choice."}
        </p>
        <CodeAndTellScoringExplainer />
      </div>
      <fieldset className="admin-code-winners" disabled={submitting}>
        <legend className="sr-only">Final winner</legend>
        {standings.length === 0 && (
          <p className="fi-muted">
            No visible projects are available. Add projects before selecting a
            winner.
          </p>
        )}
        {standings.map((row, index) => (
          <label className="admin-candidate" key={row.teamId}>
            <input
              type="radio"
              name="final-winner"
              aria-label={`Choose ${row.name}`}
              checked={winnerTeamId === row.teamId}
              onChange={() => setWinnerTeamId(row.teamId)}
            />
            <span>
              <strong>
                #{index + 1} {row.name}
              </strong>
              <small>{row.description}</small>
            </span>
            <span className="admin-candidate-score">
              {row.points} points<small>{row.ballotsCount} ballots</small>
            </span>
          </label>
        ))}
      </fieldset>
      <details className="admin-candidate-filters mb-6">
        <summary>View votes by rank</summary>
        <div
          className="admin-candidate-table"
          role="region"
          aria-label="Votes by rank"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Project</th>
                {CODE_AND_TELL_RANK_HEADERS.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.teamId}>
                  <td>{row.name}</td>
                  {CODE_AND_TELL_RANK_HEADERS.map((_, index) => (
                    <td key={index}>{row.rankCounts[index] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <footer className="admin-results-actions">
        <button
          type="submit"
          className="fi-transport"
          disabled={submitting || !winnerTeamId || !standings.length}
        >
          {submitting ? "Saving…" : "Save and review"}
        </button>
        <button
          type="button"
          className="fi-key"
          disabled={submitting}
          onClick={close}
        >
          Cancel
        </button>
      </footer>
    </form>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "../../../../convex/_generated/dataModel";

type CategoryWinner = { category: string; teamId: Id<"teams"> };
type Ranking = {
  teamId: string;
  teamName?: string;
  cleanScore: number;
  rawScore?: number;
  flagged?: boolean;
};

export function DemoDayWinnersPanel({
  eventId,
  teams,
  categories,
  existingOverallWinner,
  existingCategoryWinners = [],
  rankings = [],
  onClose,
  onSubmit,
}: {
  eventId: Id<"events">;
  teams: Array<{
    _id: Id<"teams">;
    name: string;
    hidden?: boolean;
    courseCode?: string;
  }>;
  categories: string[];
  existingOverallWinner?: Id<"teams">;
  existingCategoryWinners?: CategoryWinner[];
  rankings?: Ranking[];
  onClose: () => void;
  onSubmit: (args: {
    eventId: Id<"events">;
    overallWinner: Id<"teams">;
    categoryWinners: CategoryWinner[];
  }) => Promise<unknown>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [overallWinner, setOverallWinner] = useState<Id<"teams"> | "">(
    existingOverallWinner ?? "",
  );
  const [categoryWinners, setCategoryWinners] = useState<
    Record<string, Id<"teams"> | "">
  >(() =>
    Object.fromEntries(
      existingCategoryWinners.map((winner) => [winner.category, winner.teamId]),
    ),
  );
  const [award, setAward] = useState("overall");
  const metrics = new Map(rankings.map((row) => [String(row.teamId), row]));
  const visibleTeams = teams
    .filter((team) => !team.hidden)
    .sort(
      (a, b) =>
        (metrics.get(String(b._id))?.cleanScore ?? 0) -
          (metrics.get(String(a._id))?.cleanScore ?? 0) ||
        a.name.localeCompare(b.name),
    );
  const selected =
    award === "overall" ? overallWinner : categoryWinners[award] || "";
  const choose = (id: Id<"teams"> | "") =>
    award === "overall"
      ? setOverallWinner(id)
      : setCategoryWinners((current) => ({ ...current, [award]: id }));
  const initialCategories = Object.fromEntries(
    existingCategoryWinners.map((winner) => [winner.category, winner.teamId]),
  );
  const dirty =
    overallWinner !== (existingOverallWinner ?? "") ||
    categories.some(
      (category) =>
        (categoryWinners[category] || "") !==
        (initialCategories[category] || ""),
    );
  const close = () => {
    if (
      !submitting &&
      (!dirty || window.confirm("Discard unsaved winner selections?"))
    )
      onClose();
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!overallWinner) {
      setError("Choose an overall winner before saving.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        eventId,
        overallWinner,
        categoryWinners: categories.flatMap((category) =>
          categoryWinners[category]
            ? [{ category, teamId: categoryWinners[category] }]
            : [],
        ),
      });
      toast.success("Winners saved. Review them before publishing.");
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save winners. Try again.",
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
          <h2>Choose winners</h2>
          <p>
            Select an award, then choose a project from the standings. Category
            awards are optional.
          </p>
        </div>
        <button
          className="fi-key"
          type="button"
          onClick={close}
          disabled={submitting}
        >
          Back to results
        </button>
      </header>
      {error && (
        <p role="alert" className="admin-result-error">
          {error}
        </p>
      )}
      <fieldset disabled={submitting} className="admin-winner-layout">
        <label className="admin-search admin-award-picker">
          Award
          <select
            value={award}
            onChange={(event) => setAward(event.target.value)}
          >
            <option value="overall">Overall winner</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <div className="admin-award-choices">
          <h3>Awards</h3>
          {[
            { key: "overall", label: "Overall winner" },
            ...categories.map((category) => ({
              key: category,
              label: category,
            })),
          ].map(({ key, label }) => {
            const id = key === "overall" ? overallWinner : categoryWinners[key];
            return (
              <button
                type="button"
                key={key}
                aria-pressed={award === key}
                onClick={() => setAward(key)}
              >
                <span>{label}</span>{" "}
                <small>
                  {teams.find((team) => team._id === id)?.name ??
                    (key === "overall"
                      ? "Winner needed"
                      : "Optional · not selected")}
                </small>
              </button>
            );
          })}
        </div>
        <div className="admin-winner-candidates">
          <h3>{award === "overall" ? "Overall winner" : award}</h3>
          <p className="fi-muted">
            {selected
              ? `Selected: ${teams.find((team) => team._id === selected)?.name ?? "Unavailable project"}`
              : "No project selected"}
          </p>
          <label className="admin-search">
            Find a project
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or course"
            />
          </label>
          {award !== "overall" && (
            <button className="fi-key" type="button" onClick={() => choose("")}>
              Leave this category unawarded
            </button>
          )}
          <div
            className="admin-candidate-list"
            role="group"
            aria-label={`Candidates for ${award === "overall" ? "overall winner" : award}`}
          >
            {visibleTeams
              .filter((team) =>
                `${team.name} ${team.courseCode ?? ""}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((team) => {
                const row = metrics.get(String(team._id));
                return (
                  <label className="admin-candidate" key={team._id}>
                    <input
                      type="radio"
                      aria-label={`Choose ${team.name}`}
                      name="demo-winner"
                      checked={selected === team._id}
                      onChange={() => choose(team._id)}
                    />
                    <span>
                      <strong>{team.name}</strong>
                      <small>
                        {team.courseCode}
                        {row?.flagged ? " · Flagged for review" : ""}
                      </small>
                    </span>
                    <span className="admin-candidate-score">
                      {row?.cleanScore ?? 0}
                      <small>clean appreciations</small>
                    </span>
                  </label>
                );
              })}
            {!visibleTeams.some((team) =>
              `${team.name} ${team.courseCode ?? ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <p>No projects match this search.</p>}
          </div>
        </div>
      </fieldset>
      <footer className="admin-results-actions">
        <button
          type="submit"
          disabled={submitting || !overallWinner}
          className="fi-transport"
        >
          {submitting ? "Saving…" : "Save and review"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={close}
          className="fi-key"
        >
          Cancel
        </button>
      </footer>
    </form>
  );
}

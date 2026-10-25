import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  scorecardTotal,
  type CategoryScoreEntry,
} from "../../../../shared/judgingInsights";

type Winner = {
  prizeId: Id<"prizes">;
  teamId: Id<"teams">;
  placement?: number;
  notes?: string;
};
type Candidate = {
  teamId: Id<"teams">;
  teamName: string;
  track?: string;
  averageScore: number;
  judgeCount: number;
};
type PrizeEntry = {
  prize: {
    _id: Id<"prizes">;
    name: string;
    sponsorName?: string;
    description?: string;
    isActive?: boolean;
    scoreBasis?: "overall" | "categories" | "none";
    scoreCategoryNames?: string[];
  };
  candidates: Candidate[];
};

export function PrizeWinnerWizardPanel({
  eventId,
  deliberationData,
  existingWinners,
  detailedScores,
  onClose,
  onSubmit,
}: {
  eventId: Id<"events">;
  deliberationData: { prizes: PrizeEntry[] } | null | undefined;
  existingWinners: Winner[];
  detailedScores?: {
    categories?: string[];
    categoryRubric?: Array<{ name: string; weight: number }>;
    teamRankings?: Array<{
      team: { _id: string };
      categoryAverages: Record<string, number>;
      scores?: Array<{ categoryScores: CategoryScoreEntry[] }>;
    }>;
  } | null;
  onClose: () => void;
  onSubmit: (args: {
    eventId: Id<"events">;
    winners: Winner[];
  }) => Promise<unknown>;
}) {
  const prizes = (deliberationData?.prizes ?? []).filter(
    (entry) => entry.prize.isActive !== false,
  );
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(existingWinners.map((row) => [row.prizeId, row.teamId])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existingWinners.map((row) => [row.prizeId, row.notes ?? ""]),
    ),
  );
  const [saved, setSaved] = useState(() => JSON.stringify({ selected, notes }));
  const [prizeId, setPrizeId] = useState<string>(prizes[0]?.prize._id ?? "");
  const [sponsor, setSponsor] = useState("");
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("");
  const [minimumScore, setMinimumScore] = useState("");
  const [minimumJudges, setMinimumJudges] = useState("");
  const [categoryMinimums, setCategoryMinimums] = useState<
    Record<string, string>
  >({});
  const [sort, setSort] = useState(
    prizes[0]?.prize.scoreBasis === "none" ? "name" : "score",
  );
  const [direction, setDirection] = useState(
    prizes[0]?.prize.scoreBasis === "none" ? "asc" : "desc",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const entry = prizes.find((row) => row.prize._id === prizeId);
  const allCategories = detailedScores?.categories ?? [];
  const usesSkills = entry?.prize.scoreBasis === "categories";
  const noScoreHint = entry?.prize.scoreBasis === "none";
  const categories = usesSkills
    ? allCategories.filter((name) =>
        entry?.prize.scoreCategoryNames?.includes(name),
      )
    : allCategories;
  const rubric = detailedScores?.categoryRubric;
  // Each prize category contributes five points; event weights apply to overall scores.
  const signalRubric = useMemo(
    () =>
      rubric
        ?.filter((category) =>
          entry?.prize.scoreCategoryNames?.includes(category.name),
        )
        .map(({ name }) => ({ name, weight: 1 })) ?? [],
    [rubric, entry],
  );
  const overallMax = rubric?.reduce(
    (sum, category) => sum + category.weight * 5,
    0,
  );
  const signalMax = signalRubric.length * 5;
  const maximumScore = usesSkills ? signalMax : overallMax;
  const scoreLabel = usesSkills ? "Prize score" : "Overall score";
  const maximumLabel = maximumScore
    ? ` / ${Number(maximumScore.toFixed(2))}`
    : "";
  const signalScores = useMemo(
    () =>
      new Map(
        (detailedScores?.teamRankings ?? []).map((row) => {
          const totals = (row.scores ?? [])
            .map((score) => scorecardTotal(score.categoryScores, signalRubric))
            .filter((total): total is number => total !== null);
          return [
            String(row.team._id),
            {
              score: totals.length
                ? totals.reduce((sum, total) => sum + total, 0) / totals.length
                : null,
              judgeCount: totals.length,
            },
          ];
        }),
      ),
    [detailedScores, signalRubric],
  );
  const categoryScores = new Map(
    (detailedScores?.teamRankings ?? []).map((row) => [
      String(row.team._id),
      row.categoryAverages,
    ]),
  );
  const assignedCount = prizes.filter((row) => selected[row.prize._id]).length;
  const dirty = saved !== JSON.stringify({ selected, notes });
  const sponsors = [
    ...new Set(
      prizes
        .map((row) => row.prize.sponsorName)
        .filter((value): value is string => !!value),
    ),
  ];
  const tracks = [
    ...new Set(
      (entry?.candidates ?? [])
        .map((row) => row.track)
        .filter((value): value is string => !!value),
    ),
  ];
  const candidates = (entry?.candidates ?? [])
    .map((candidate) => ({
      ...candidate,
      score: usesSkills
        ? (signalScores.get(String(candidate.teamId))?.score ?? null)
        : candidate.judgeCount
          ? candidate.averageScore
          : null,
      countedJudges: usesSkills
        ? (signalScores.get(String(candidate.teamId))?.judgeCount ?? 0)
        : candidate.judgeCount,
    }))
    .filter(
      (row) =>
        row.teamName.toLowerCase().includes(search.toLowerCase()) &&
        (!track || row.track === track) &&
        (!minimumScore ||
          (row.score !== null && row.score >= Number(minimumScore))) &&
        (!minimumJudges || row.countedJudges >= Number(minimumJudges)) &&
        Object.entries(categoryMinimums).every(
          ([category, value]) =>
            !value ||
            (categoryScores.get(String(row.teamId))?.[category] ?? 0) >=
              Number(value),
        ),
    )
    .sort((a, b) => {
      // Missing signal scores stay last in either sort direction.
      if (sort === "score" && (a.score === null || b.score === null)) {
        return a.score === b.score
          ? a.teamName.localeCompare(b.teamName)
          : a.score === null
            ? 1
            : -1;
      }
      const comparison =
        sort === "name"
          ? a.teamName.localeCompare(b.teamName)
          : sort === "judges"
            ? a.countedJudges - b.countedJudges
            : sort === "score"
              ? (a.score ?? 0) - (b.score ?? 0)
              : sort === "overall"
                ? a.averageScore - b.averageScore
                : (categoryScores.get(String(a.teamId))?.[sort] ?? 0) -
                  (categoryScores.get(String(b.teamId))?.[sort] ?? 0);
      return direction === "asc" ? comparison : -comparison;
    });
  const activeFilters = [
    track,
    minimumScore,
    minimumJudges,
    ...Object.values(categoryMinimums),
  ].filter(Boolean).length;
  const clearFilters = () => {
    setTrack("");
    setMinimumScore("");
    setMinimumJudges("");
    setCategoryMinimums({});
    setSearch("");
  };
  const choosePrize = (id: string) => {
    setPrizeId(id);
    clearFilters();
    const manual =
      prizes.find((row) => row.prize._id === id)?.prize.scoreBasis === "none";
    setSort(manual ? "name" : "score");
    setDirection(manual ? "asc" : "desc");
  };
  const close = () => {
    if (
      !saving &&
      (!dirty || window.confirm("Discard unsaved winner selections?"))
    )
      onClose();
  };
  const save = async (review: boolean) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        eventId,
        winners: prizes.flatMap(({ prize }) =>
          selected[prize._id]
            ? [
                {
                  prizeId: prize._id,
                  teamId: selected[prize._id] as Id<"teams">,
                  placement: 1,
                  notes: notes[prize._id]?.trim() || undefined,
                },
              ]
            : [],
        ),
      });
      setSaved(JSON.stringify({ selected, notes }));
      toast.success(
        review
          ? "Winners saved. Review them before publishing."
          : "Progress saved",
      );
      if (review) onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save winners. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-winner-editor" aria-busy={saving}>
      <header className="admin-results-heading">
        <div>
          <h2>Choose prize winners</h2>
          <p>
            {assignedCount} of {prizes.length} selected.
          </p>
        </div>
        <button className="fi-key" onClick={close} disabled={saving}>
          Back to results
        </button>
      </header>
      {error && (
        <p role="alert" className="admin-result-error">
          {error}
        </p>
      )}
      <fieldset className="admin-winner-layout" disabled={saving}>
        <label className="admin-search admin-award-picker">
          Prize
          <select
            value={prizeId}
            onChange={(event) => {
              choosePrize(event.target.value);
            }}
          >
            {prizes.map(({ prize }) => (
              <option key={prize._id} value={prize._id}>
                {prize.name}
                {selected[prize._id] ? " · selected" : " · winner needed"}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-award-choices">
          <h3>Prizes</h3>
          {sponsors.length > 0 && (
            <label className="admin-search">
              Sponsor
              <select
                value={sponsor}
                onChange={(event) => {
                  setSponsor(event.target.value);
                  const first = prizes.find(
                    (row) =>
                      !event.target.value ||
                      row.prize.sponsorName === event.target.value,
                  );
                  if (first) {
                    choosePrize(first.prize._id);
                  }
                }}
              >
                <option value="">All sponsors</option>
                {sponsors.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          {prizes
            .filter((row) => !sponsor || row.prize.sponsorName === sponsor)
            .map(({ prize, candidates: entrants }) => (
              <button
                key={prize._id}
                aria-pressed={prizeId === prize._id}
                onClick={() => {
                  choosePrize(prize._id);
                }}
              >
                <span>{prize.name}</span>{" "}
                <small>
                  {entrants.find((row) => row.teamId === selected[prize._id])
                    ?.teamName ??
                    (selected[prize._id]
                      ? "Selection unavailable · choose again"
                      : "Winner needed")}
                </small>
              </button>
            ))}
        </div>
        {entry ? (
          <div className="admin-winner-candidates">
            <h3>{entry.prize.name}</h3>
            {entry.prize.description && (
              <p className="fi-muted">{entry.prize.description}</p>
            )}
            {usesSkills ? (
              <div className="space-y-1">
                <p>
                  <strong>Prize categories:</strong>{" "}
                  {(entry.prize.scoreCategoryNames ?? []).join(" · ")}
                </p>
                {(!rubric || !categories.length) && (
                  <p role="status">Category scores are not available yet.</p>
                )}
              </div>
            ) : noScoreHint ? (
              <p className="fi-muted">
                No score hint is configured for this prize. Overall scores are
                shown for context; use the prize criteria to choose a winner.
              </p>
            ) : (
              <p className="fi-muted">
                Overall scores use all rubric categories and their weights.
              </p>
            )}
            <p className="fi-muted">
              {entry.candidates.length} eligible entrants ·{" "}
              {selected[prizeId]
                ? `Selected: ${entry.candidates.find((row) => row.teamId === selected[prizeId])?.teamName ?? "Unavailable entrant"}`
                : "No winner selected"}
            </p>
            <div className="admin-candidate-tools">
              <label className="admin-search">
                Find an entrant
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search team name"
                />
              </label>
              <label className="admin-search">
                Sort by
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setDirection(
                      event.target.value === "name" ? "asc" : "desc",
                    );
                  }}
                >
                  <option value="score">{scoreLabel}</option>
                  {usesSkills && <option value="overall">Overall score</option>}
                  <option value="name">Team name</option>
                  <option value="judges">Judge count</option>
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <button
                className="fi-key"
                onClick={() =>
                  setDirection(direction === "asc" ? "desc" : "asc")
                }
              >
                {direction === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>
            <details className="admin-candidate-filters">
              <summary>
                Filter entrants
                {activeFilters ? ` · ${activeFilters} active` : ""}
              </summary>
              <div className="admin-candidate-tools">
                <label className="admin-search">
                  Track
                  <select
                    value={track}
                    onChange={(event) => setTrack(event.target.value)}
                  >
                    <option value="">All tracks</option>
                    {tracks.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-search">
                  Minimum {scoreLabel.toLowerCase()}
                  {maximumLabel}
                  <input
                    type="number"
                    min="0"
                    max={maximumScore || undefined}
                    step="0.1"
                    value={minimumScore}
                    onChange={(event) => setMinimumScore(event.target.value)}
                  />
                </label>
                <label className="admin-search">
                  Minimum judges
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minimumJudges}
                    onChange={(event) => setMinimumJudges(event.target.value)}
                  />
                </label>
                {categories.map((category) => (
                  <label key={category} className="admin-search">
                    Minimum {category}
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={categoryMinimums[category] ?? ""}
                      onChange={(event) =>
                        setCategoryMinimums((current) => ({
                          ...current,
                          [category]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
                <button className="fi-key" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            </details>
            <div
              className="admin-candidate-table"
              role="region"
              aria-label="Eligible entrant scores"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Winner</th>
                    <th>Team</th>
                    <th>
                      {scoreLabel}
                      {maximumLabel}
                    </th>
                    {usesSkills && (
                      <th>
                        Overall score
                        {overallMax
                          ? ` / ${Number(overallMax.toFixed(2))}`
                          : ""}
                      </th>
                    )}
                    <th>Judges</th>
                    {categories.map((category) => (
                      <th key={category}>{category}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr
                      key={candidate.teamId}
                      data-selected={selected[prizeId] === candidate.teamId}
                    >
                      <td>
                        <input
                          type="radio"
                          name="prize-winner"
                          id={`prize-candidate-${candidate.teamId}`}
                          aria-label={`Choose ${candidate.teamName}`}
                          checked={selected[prizeId] === candidate.teamId}
                          onChange={() =>
                            setSelected((current) => ({
                              ...current,
                              [prizeId]: candidate.teamId,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <label htmlFor={`prize-candidate-${candidate.teamId}`}>
                          {candidate.teamName}
                        </label>
                        <small>{candidate.track}</small>
                      </td>
                      <td>
                        {candidate.score !== null
                          ? candidate.score.toFixed(2)
                          : usesSkills
                            ? "Unscored for this prize"
                            : "Unscored"}
                      </td>
                      {usesSkills && (
                        <td>
                          {candidate.judgeCount
                            ? candidate.averageScore.toFixed(2)
                            : "Unscored"}
                        </td>
                      )}
                      <td>{candidate.countedJudges}</td>
                      {categories.map((category) => (
                        <td key={category}>
                          {categoryScores
                            .get(String(candidate.teamId))
                            ?.[category]?.toFixed(2) ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {candidates.length === 0 && (
                <p className="p-4 fi-muted">
                  {entry.candidates.length
                    ? "No entrants match these filters."
                    : "No teams are entered for this prize. Review prize entries before choosing a winner."}
                </p>
              )}
            </div>
            {selected[prizeId] && (
              <button
                className="fi-key mt-3"
                onClick={() =>
                  setSelected((current) => ({ ...current, [prizeId]: "" }))
                }
              >
                Clear this winner
              </button>
            )}
            <label className="admin-search mt-4">
              Selection notes, optional
              <textarea
                rows={2}
                value={notes[prizeId] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [prizeId]: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        ) : (
          <p>No prizes are configured.</p>
        )}
      </fieldset>
      <footer className="admin-results-actions">
        <span className="fi-muted" role="status">
          {dirty ? "Unsaved changes" : "Selections saved"}
        </span>
        <button
          className="fi-key"
          disabled={saving || !prizes.length}
          onClick={() => void save(false)}
        >
          {saving ? "Saving…" : "Save progress"}
        </button>
        <button
          className="fi-transport"
          disabled={saving || !prizes.length}
          onClick={() => void save(true)}
        >
          {saving ? "Saving…" : "Save and review"}
        </button>
      </footer>
    </section>
  );
}

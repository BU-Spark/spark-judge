import { useEffect, useMemo, useRef, useState } from "react";
import { formatRubricPercent } from "../../../lib/scoringWeights";
import {
  findTiedIds,
  judgeLeniency,
  normalizeByJudge,
  rankByValue,
  scorecardTotal,
  typicalJudgeCount,
  type ScoreRecord,
} from "../../../../shared/judgingInsights";
import "../judging/judging.css";

type Basis = "raw" | "normalized";

export type ScorePrizeFilter = {
  id: string;
  name: string;
  teamIds: string[];
  /** Categories the prize is judged on; empty means every category. */
  categoryNames: string[];
};

function formatSigned(value: number, digits = 2) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

function TeamScorecards({
  ranking,
  categories,
  judgeNames,
  maxTotal,
  totalOf,
  onClose,
}: {
  totalOf: (score: any) => number | null;
  ranking: any;
  categories: string[];
  judgeNames: Map<string, string>;
  maxTotal: number | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (ranking && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!ranking && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [ranking]);

  const scores: any[] = ranking?.scores ?? [];
  const totals = scores
    .map(totalOf)
    .filter((total): total is number => total !== null);
  return (
    <dialog
      ref={ref}
      className="admin-drawer"
      aria-label={ranking ? `${ranking.team.name} scorecards` : "Scorecards"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {ranking && (
        <div className="admin-drawer-inner">
          <header>
            <div>
              <h2>{ranking.team.name}</h2>
              <p>
                {scores.length} {scores.length === 1 ? "scorecard" : "scorecards"} · average{" "}
                {ranking.averageScore.toFixed(2)}
                {maxTotal ? ` of ${maxTotal}` : ""}
                {totals.length > 1 &&
                  ` · range ${Math.min(...totals).toFixed(2)}–${Math.max(...totals).toFixed(2)}`}
              </p>
            </div>
            <button type="button" className="fi-key" onClick={onClose}>
              Close
            </button>
          </header>
          {scores.length === 0 ? (
            <p className="admin-muted">No judge has scored this team yet.</p>
          ) : (
            <div className="admin-drawer-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Judge</th>
                    <th scope="col">Total</th>
                    {categories.map((category) => (
                      <th key={category} scope="col">
                        {category}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...scores]
                    .sort((a, b) => (totalOf(b) ?? -1) - (totalOf(a) ?? -1))
                    .map((score) => (
                      <tr key={String(score._id ?? score.judgeId)}>
                        <th scope="row">
                          {judgeNames.get(String(score.judgeId)) ?? "Judge"}
                          {score.submittedAt && (
                            <small>
                              {new Date(score.submittedAt).toLocaleString(undefined, {
                                weekday: "short",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </small>
                          )}
                        </th>
                        <td className="admin-num">{totalOf(score)?.toFixed(2) ?? "N/A"}</td>
                        {categories.map((category) => {
                          const entry = (score.categoryScores ?? []).find(
                            (row: any) => row.category === category,
                          );
                          return (
                            <td key={category} className="admin-num">
                              {!entry
                                ? "—"
                                : entry.optedOut || entry.score === null
                                  ? "N/A"
                                  : entry.score}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

export function ScoringDashboard({
  scores,
  prizeFilters = [],
}: {
  prizeFilters?: ScorePrizeFilter[];
  scores: {
    teamRankings: any[];
    categoryRankings: Record<string, any[]>;
    judgeBreakdown: any[];
    categories: string[];
    categoryRubric?: Array<{
      name: string;
      weight: number;
      percent: number;
      maxPoints: number;
    }>;
  };
  viewMode: "table" | "chart";
  setViewMode: (mode: "table" | "chart") => void;
}) {
  const [sortColumn, setSortColumn] = useState<string>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [basis, setBasis] = useState<Basis>("raw");
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  // "all", "prize:<id>", or "track:<name>"
  const [view, setView] = useState("all");
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [categoriesFromPrize, setCategoriesFromPrize] = useState(false);

  const tracks = useMemo(
    () =>
      [
        ...new Set(
          scores.teamRankings
            .map((row) => row.team.track as string | undefined)
            .filter((track): track is string => !!track),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [scores.teamRankings],
  );
  const activePrize = view.startsWith("prize:")
    ? prizeFilters.find((prize) => `prize:${prize.id}` === view)
    : undefined;
  const activeTrack = view.startsWith("track:") ? view.slice("track:".length) : undefined;
  const viewTeamIds = activePrize ? new Set(activePrize.teamIds) : null;
  const inView = (row: any) =>
    viewTeamIds
      ? viewTeamIds.has(String(row.team._id))
      : activeTrack
        ? row.team.track === activeTrack
        : true;

  const changeView = (next: string) => {
    setView(next);
    const prize = prizeFilters.find((candidate) => `prize:${candidate.id}` === next);
    const prizeCategories = (prize?.categoryNames ?? []).filter((name) =>
      scores.categories.includes(name),
    );
    if (prizeCategories.length > 0) {
      setExcluded(new Set(scores.categories.filter((name) => !prizeCategories.includes(name))));
      setCategoriesFromPrize(true);
    } else if (categoriesFromPrize) {
      setExcluded(new Set());
      setCategoriesFromPrize(false);
    }
  };
  const toggleCategory = (name: string) => {
    const next = new Set(excluded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExcluded(next);
    setCategoriesFromPrize(false);
  };
  const resetView = () => {
    setView("all");
    setExcluded(new Set());
    setCategoriesFromPrize(false);
  };

  const rubric = useMemo(
    () =>
      scores.categoryRubric?.length
        ? scores.categoryRubric
        : scores.categories.map((name) => ({ name, weight: 1, percent: 0, maxPoints: 5 })),
    [scores.categoryRubric, scores.categories],
  );
  const includedCategories = scores.categories.filter((name) => !excluded.has(name));
  const includedRubric = useMemo(
    () => rubric.filter((category) => !excluded.has(category.name)),
    [rubric, excluded],
  );
  const customCategories = excluded.size > 0;
  // Stored totals stay authoritative until a category is removed from the view.
  const totalOf = useMemo(
    () =>
      (score: any): number | null =>
        customCategories
          ? scorecardTotal(score.categoryScores ?? [], includedRubric)
          : score.totalScore,
    [customCategories, includedRubric],
  );
  const viewRankings = useMemo(
    () =>
      scores.teamRankings.map((row) => {
        const totals = (row.scores ?? [])
          .map(totalOf)
          .filter((total: number | null): total is number => total !== null);
        return {
          ...row,
          averageScore: customCategories
            ? totals.length
              ? totals.reduce((sum: number, total: number) => sum + total, 0) / totals.length
              : 0
            : row.averageScore,
          countedScores: customCategories ? totals.length : row.judgeCount,
        };
      }),
    [scores.teamRankings, totalOf, customCategories],
  );

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "name" || column === "rank" ? "asc" : "desc");
    }
  };

  // Judges are calibrated against every scorecard they submitted, not just the
  // filtered teams, so a judge with one FirstHacks team still counts.
  const records: ScoreRecord[] = useMemo(
    () =>
      scores.teamRankings
        .filter((row) => !row.team.hidden)
        .flatMap((row) =>
          (row.scores ?? []).flatMap((score: any) => {
            const total = totalOf(score);
            return total === null
              ? []
              : [
                  {
                    judgeId: String(score.judgeId),
                    teamId: String(score.teamId),
                    totalScore: total,
                    submittedAt: score.submittedAt,
                  },
                ];
          }),
        ),
    [scores.teamRankings, totalOf],
  );
  const normalized = useMemo(() => normalizeByJudge(records), [records]);
  const canNormalize = [...normalized.values()].some((row) => row.value !== null);

  const eventRankable = viewRankings.filter(
    (row) => !row.team.hidden && row.countedScores > 0,
  );
  const visibleRankings = viewRankings.filter(inView);
  const rankable = eventRankable.filter(inView);
  const filtered = view !== "all";
  const rawRanks = rankByValue(
    rankable.map((row) => ({ id: String(row.team._id), value: row.averageScore })),
  );
  const normalizedRanks = rankByValue(
    rankable.map((row) => ({
      id: String(row.team._id),
      value: normalized.get(String(row.team._id))?.value ?? null,
    })),
  );
  const ranks = basis === "raw" ? rawRanks : normalizedRanks;
  // Cohorts differ in size, so compare each team with the event's typical count.
  const target = typicalJudgeCount(eventRankable.map((row) => row.judgeCount));
  const tied = findTiedIds(ranks);

  const judgeNames = new Map<string, string>(
    scores.judgeBreakdown
      .filter((judge) => judge.judgeId)
      .map((judge) => [String(judge.judgeId), judge.judgeName as string]),
  );
  // Older deployments omit judgeId from the breakdown; number judges instead.
  for (const record of records) {
    if (!judgeNames.has(record.judgeId)) {
      judgeNames.set(record.judgeId, `Judge ${judgeNames.size + 1}`);
    }
  }
  const leniency = judgeLeniency(records).filter((row) => row.count >= 2);
  const maxOffset = Math.max(1, ...leniency.map((row) => Math.abs(row.offset)));

  const maxTotal = scores.categoryRubric?.length
    ? Math.round(includedRubric.reduce((sum, category) => sum + category.maxPoints, 0))
    : null;
  const lowCoverage = rankable.filter(
    (row) => row.judgeCount === 1 || row.judgeCount <= target / 2,
  ).length;

  const sortedRankings = [...visibleRankings].sort((a, b) => {
    let comparison = 0;
    const id = (row: any) => String(row.team._id);
    switch (sortColumn) {
      case "rank": {
        const ar = ranks.get(id(a)) ?? Number.MAX_SAFE_INTEGER;
        const br = ranks.get(id(b)) ?? Number.MAX_SAFE_INTEGER;
        comparison = ar - br || a.team.name.localeCompare(b.team.name);
        break;
      }
      case "name":
        comparison = a.team.name.localeCompare(b.team.name);
        break;
      case "averageScore":
        comparison = a.averageScore - b.averageScore;
        break;
      case "normalized":
        comparison =
          (normalized.get(id(a))?.value ?? -Infinity) -
          (normalized.get(id(b))?.value ?? -Infinity);
        break;
      case "judges":
        comparison = a.judgeCount - b.judgeCount;
        break;
      default:
        if (scores.categories.includes(sortColumn)) {
          comparison =
            (a.categoryAverages?.[sortColumn] || 0) -
            (b.categoryAverages?.[sortColumn] || 0);
        }
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const rubricByCategory = new Map(
    (scores.categoryRubric || []).map((category) => [category.name, category]),
  );

  const ariaSort = (column: string) =>
    sortColumn === column
      ? sortDirection === "asc"
        ? "ascending"
        : "descending"
      : "none";

  const SortIcon = ({ column }: { column: string }) => (
    <span aria-hidden="true" className="admin-sort-icon" data-active={sortColumn === column}>
      {sortColumn !== column ? "↕" : sortDirection === "asc" ? "↑" : "↓"}
    </span>
  );

  const openRanking =
    viewRankings.find((row) => String(row.team._id) === openTeamId) ?? null;
  const viewLabel = activePrize?.name ?? activeTrack ?? null;

  return (
    <div className="space-y-4">
      <div className="fi-panel p-6 fi-surface">
        <div className="admin-scores-head">
          <div>
            <h4 className="text-xl fi-zone font-bold fi-ink">Rankings</h4>
            <p className="mt-1 text-sm fi-muted">
              {maxTotal
                ? `Average total out of ${maxTotal}. Judges score each category 1–5; rubric weights set each category's share.`
                : "Judges score each category 1–5; rubric weights set each category's share."}{" "}
              Select a team to see every scorecard.
            </p>
            {lowCoverage > 0 && (
              <p className="admin-scores-warning">
                {lowCoverage} ranked {lowCoverage === 1 ? "team was" : "teams were"} scored by half as many judges as
                most teams ({target}) or fewer. Treat those ranks with caution.
              </p>
            )}
          </div>
          <fieldset className="admin-segmented">
            <legend>Rank by</legend>
            <label>
              <input
                type="radio"
                name="ranking-basis"
                checked={basis === "raw"}
                onChange={() => setBasis("raw")}
              />
              <span>Raw average</span>
            </label>
            <label>
              <input
                type="radio"
                name="ranking-basis"
                checked={basis === "normalized"}
                onChange={() => setBasis("normalized")}
                disabled={!canNormalize}
              />
              <span>Judge-normalized</span>
            </label>
          </fieldset>
        </div>
        <div className="admin-score-filters">
          <label className="admin-score-filter">
            <span>Show</span>
            <select value={view} onChange={(event) => changeView(event.target.value)}>
              <option value="all">All teams</option>
              {prizeFilters.length > 0 && (
                <optgroup label="Entered in prize">
                  {prizeFilters.map((prize) => (
                    <option key={prize.id} value={`prize:${prize.id}`}>
                      {prize.name} ({prize.teamIds.length})
                    </option>
                  ))}
                </optgroup>
              )}
              {tracks.length > 0 && (
                <optgroup label="Track">
                  {tracks.map((track) => (
                    <option key={track} value={`track:${track}`}>
                      {track}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {scores.categories.length > 1 && (
            <fieldset className="admin-score-categories">
              <legend>Count categories</legend>
              {scores.categories.map((name) => {
                const checked = !excluded.has(name);
                return (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={checked}
                      // At least one category has to stay in the total.
                      disabled={checked && includedCategories.length === 1}
                      onChange={() => toggleCategory(name)}
                    />
                    <span>{name}</span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </div>
        {(filtered || customCategories) && (
          <p className="admin-view-summary" role="status">
            <span>
              Showing {visibleRankings.length} of {scores.teamRankings.length} teams
              {viewLabel ? ` in ${viewLabel}` : ""}
              {customCategories &&
                ` · ${includedCategories.length} of ${scores.categories.length} categories${
                  categoriesFromPrize ? " (set by this prize)" : ""
                }`}
              {" · "}ranks are within this view, not official.
            </span>
            <button type="button" className="admin-link-button" onClick={resetView}>
              Reset view
            </button>
          </p>
        )}

        {basis === "normalized" && (
          <p className="admin-scores-note">
            Each judge's totals are compared with that judge's own average, so a harsh or generous judge
            doesn't decide a rank. Judges who scored only one team are left out. Arrows show movement
            from the raw ranking. Raw averages remain the official default.
          </p>
        )}

        <div className="admin-scores-table">
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <th aria-sort={ariaSort("rank")}>
                  <button type="button" onClick={() => handleSort("rank")}>
                    Rank <SortIcon column="rank" />
                  </button>
                </th>
                <th aria-sort={ariaSort("name")}>
                  <button type="button" onClick={() => handleSort("name")}>
                    Team Name <SortIcon column="name" />
                  </button>
                </th>
                <th aria-sort={ariaSort("averageScore")}>
                  <button type="button" onClick={() => handleSort("averageScore")}>
                    Avg{maxTotal ? ` / ${maxTotal}` : ""} <SortIcon column="averageScore" />
                  </button>
                </th>
                {basis === "normalized" && (
                  <th aria-sort={ariaSort("normalized")}>
                    <button type="button" onClick={() => handleSort("normalized")}>
                      Normalized <SortIcon column="normalized" />
                    </button>
                  </th>
                )}
                <th aria-sort={ariaSort("judges")}>
                  <button type="button" onClick={() => handleSort("judges")}>
                    Judges <SortIcon column="judges" />
                  </button>
                </th>
                {includedCategories.map((cat) => (
                  <th key={cat} aria-sort={ariaSort(cat)}>
                    <button type="button" onClick={() => handleSort(cat)}>
                      <span className="block fi-ink">{cat}</span>
                      {rubricByCategory.has(cat) && (
                        <span className="block fi-muted">
                          {formatRubricPercent(rubricByCategory.get(cat)!.percent)}
                        </span>
                      )}
                      <SortIcon column={cat} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((ranking) => {
                const id = String(ranking.team._id);
                const rank = ranks.get(id);
                const rawRank = rawRanks.get(id);
                const move =
                  basis === "normalized" && rank !== undefined && rawRank !== undefined
                    ? rawRank - rank
                    : 0;
                const coverage =
                  ranking.judgeCount === 0
                    ? "none"
                    : ranking.judgeCount === 1
                      ? "single"
                      : ranking.judgeCount <= target / 2
                        ? "low"
                        : "met";
                const norm = normalized.get(id);
                return (
                  <tr key={id} data-hidden={ranking.team.hidden ? "true" : undefined}>
                    <td className="admin-rank-cell">
                      {ranking.team.hidden ? (
                        <span>Hidden</span>
                      ) : rank !== undefined ? (
                        <>
                          <span>{`#${rank}`}</span>
                          {tied.has(id) && <span className="admin-chip">Tied</span>}
                          {Math.abs(move) >= 2 && (
                            <span
                              className="admin-move"
                              data-direction={move > 0 ? "up" : "down"}
                              title={`Raw rank #${rawRank}`}
                            >
                              {move > 0 ? `▲${move}` : `▼${-move}`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Unranked</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-team-link"
                        onClick={() => setOpenTeamId(id)}
                      >
                        {ranking.team.name}
                      </button>
                    </td>
                    <td className="admin-num">{ranking.averageScore.toFixed(2)}</td>
                    {basis === "normalized" && (
                      <td className="admin-num">
                        {norm?.value !== null && norm?.value !== undefined
                          ? formatSigned(norm.value)
                          : "—"}
                      </td>
                    )}
                    <td className="admin-num">
                      <span className="admin-coverage-cell" data-coverage={coverage}>
                        {ranking.judgeCount}
                        {coverage === "single" && <small>Single judge</small>}
                        {coverage === "low" && <small>Fewer judges</small>}
                      </span>
                    </td>
                    {includedCategories.map((cat) => (
                      <td key={cat} className="admin-num fi-muted">
                        {ranking.categoryAverages?.[cat]?.toFixed(2) || "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {scores.categoryRubric && scores.categoryRubric.length > 0 && (
          <details className="admin-rubric-details">
            <summary>Rubric weighting</summary>
            <p className="text-xs fi-muted">Category opt-outs are neutral and don't reduce a team's total.</p>
            <ul>
              {scores.categoryRubric.map((category) => (
                <li key={category.name}>
                  <span>{category.name}</span>
                  <span className="admin-num">
                    {formatRubricPercent(category.percent)} · up to {category.maxPoints.toFixed(2)} pts
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {leniency.length > 0 && (
        <section className="fi-panel p-6 fi-surface admin-calibration" aria-labelledby="calibration-title">
          <h4 id="calibration-title" className="text-lg fi-zone font-bold fi-ink">
            Judge calibration
          </h4>
          <p className="mt-1 text-sm fi-muted">
            Each judge's average total compared with the event average. Large gaps mean a judge's teams
            are helped or hurt by who judged them; compare with the normalized ranking.
          </p>
          <ul>
            {leniency.map((row) => (
              <li key={row.judgeId}>
                <span className="admin-calibration-name">
                  {judgeNames.get(row.judgeId) ?? "Judge"}
                  <small>
                    {row.count} teams · avg {row.mean.toFixed(1)}
                  </small>
                </span>
                <span className="admin-calibration-bar" aria-hidden="true">
                  <span
                    data-direction={row.offset >= 0 ? "up" : "down"}
                    style={{ width: `${(Math.abs(row.offset) / maxOffset) * 50}%` }}
                  />
                </span>
                <span className="admin-num">{formatSigned(row.offset, 1)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TeamScorecards
        ranking={openRanking}
        categories={scores.categories}
        judgeNames={judgeNames}
        maxTotal={maxTotal}
        totalOf={totalOf}
        onClose={() => setOpenTeamId(null)}
      />
    </div>
  );
}

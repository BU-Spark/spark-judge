import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "../../../../convex/_generated/dataModel";

type PrizeType = "general" | "track" | "sponsor" | "track_sponsor";

const PRIZE_TYPE_LABELS: Record<PrizeType, string> = {
  general: "General",
  track: "Track",
  sponsor: "Sponsor",
  track_sponsor: "Track + Sponsor",
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
  deliberationData: any;
  existingWinners: any[];
  detailedScores?: any;
  onClose: () => void;
  onSubmit: (args: {
    eventId: Id<"events">;
    winners: Array<{
      prizeId: Id<"prizes">;
      teamId: Id<"teams">;
      placement?: number;
      notes?: string;
    }>;
  }) => Promise<any>;
}) {
  const prizes = deliberationData?.prizes || [];
  const [selectedByPrize, setSelectedByPrize] = useState<Record<string, string>>({});
  const [notesByPrize, setNotesByPrize] = useState<Record<string, string>>({});
  const [savedByPrize, setSavedByPrize] = useState<Record<string, string>>({});
  const [savedNotesByPrize, setSavedNotesByPrize] = useState<Record<string, string>>({});
  const [currentPrizeIndex, setCurrentPrizeIndex] = useState(0);
  const [activeFilters, setActiveFilters] = useState<
    { id: string; field: string; value: string }[]
  >([]);
  const [sortField, setSortField] = useState<string>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [sponsorFilter, setSponsorFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const selected: Record<string, string> = {};
    const notes: Record<string, string> = {};
    for (const winner of existingWinners || []) {
      selected[String(winner.prizeId)] = String(winner.teamId);
      notes[String(winner.prizeId)] = winner.notes || "";
    }
    setSelectedByPrize(selected);
    setNotesByPrize(notes);
    setSavedByPrize(selected);
    setSavedNotesByPrize(notes);
  }, [existingWinners]);

  const assignedCount = Object.values(selectedByPrize).filter(Boolean).length;
  const completionPercent =
    prizes.length > 0 ? Math.round((assignedCount / prizes.length) * 100) : 0;
  const categories = detailedScores?.categories || [];

  const categoryAveragesByTeamId = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const ranking of detailedScores?.teamRankings || []) {
      if (!ranking?.team?._id) continue;
      map.set(String(ranking.team._id), ranking.categoryAverages || {});
    }
    return map;
  }, [detailedScores]);

  const hasUnsavedChanges = useMemo(() => {
    const prizeIds = prizes.map((entry: any) => String(entry.prize._id));
    for (const prizeId of prizeIds) {
      const currentWinner = selectedByPrize[prizeId] || "";
      const savedWinner = savedByPrize[prizeId] || "";
      if (currentWinner !== savedWinner) return true;

      const currentNotes = (notesByPrize[prizeId] || "").trim();
      const savedNotes = (savedNotesByPrize[prizeId] || "").trim();
      if (currentNotes !== savedNotes) return true;
    }
    return false;
  }, [notesByPrize, prizes, savedByPrize, savedNotesByPrize, selectedByPrize]);

  const sponsorOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(
          prizes
            .map((entry: any) => (entry?.prize?.sponsorName || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [prizes]
  );

  const visiblePrizes = useMemo(() => {
    if (!sponsorFilter) return prizes;
    return prizes.filter(
      (entry: any) => (entry?.prize?.sponsorName || "").trim() === sponsorFilter
    );
  }, [prizes, sponsorFilter]);

  useEffect(() => {
    if (currentPrizeIndex >= visiblePrizes.length) {
      setCurrentPrizeIndex(Math.max(0, visiblePrizes.length - 1));
    }
  }, [currentPrizeIndex, visiblePrizes.length]);

  const currentEntry = visiblePrizes[currentPrizeIndex] || null;
  const currentPrizeId = currentEntry ? String(currentEntry.prize._id) : "";
  const selectedTeamId = currentPrizeId ? selectedByPrize[currentPrizeId] || "" : "";
  const scoreHintCategories = useMemo(() => {
    const preferred = currentEntry?.prize?.scoreCategoryNames || [];
    if (preferred.length > 0) return preferred;
    return categories;
  }, [categories, currentEntry]);

  const trackOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(
          (currentEntry?.candidates || [])
            .map((candidate: any) => candidate.track as string)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [currentEntry]
  );


  const filteredCandidates = useMemo(() => {
    if (!currentEntry) return [];

    const candidates = [...(currentEntry.candidates || [])]
      .filter((candidate: any) => {
        const teamCategoryAverages =
          categoryAveragesByTeamId.get(String(candidate.teamId)) || {};

        for (const filter of activeFilters) {
          if (!filter.field || !filter.value) continue;

          if (filter.field === "track") {
            if (candidate.track !== filter.value) return false;
          } else if (filter.field === "min_score") {
            if ((candidate.averageScore || 0) < Number(filter.value)) return false;
          } else if (filter.field === "min_judges") {
            if ((candidate.judgeCount || 0) < Number(filter.value)) return false;
          } else if (filter.field.startsWith("category_")) {
            const categoryName = filter.field.replace("category_", "");
            if ((teamCategoryAverages[categoryName] ?? 0) < Number(filter.value)) return false;
          }
        }

        return true;
      });

    return candidates.sort((a: any, b: any) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = (a.teamName || "").localeCompare(b.teamName || "");
      } else if (sortField === "judges") {
        comparison = (a.judgeCount || 0) - (b.judgeCount || 0);
      } else if (sortField.startsWith("cat_")) {
        const categoryName = sortField.replace("cat_", "");
        const aScore = (categoryAveragesByTeamId.get(String(a.teamId)) || {})[categoryName] || 0;
        const bScore = (categoryAveragesByTeamId.get(String(b.teamId)) || {})[categoryName] || 0;
        comparison = aScore - bScore;
      } else {
        comparison = (a.averageScore || 0) - (b.averageScore || 0);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [currentEntry, categoryAveragesByTeamId, activeFilters, sortDirection, sortField]);

  const activeFilterCount = activeFilters.length;

  const handleSave = async () => {
    if (prizes.length === 0) {
      toast.error("No prizes configured for this event.");
      return;
    }

    const winners = prizes
      .map((entry: any) => {
        const prizeId = String(entry.prize._id);
        const selectedWinnerTeamId = selectedByPrize[prizeId];
        if (!selectedWinnerTeamId) return null;
        return {
          prizeId: entry.prize._id as Id<"prizes">,
          teamId: selectedWinnerTeamId as Id<"teams">,
          placement: 1,
          notes: notesByPrize[prizeId]?.trim() || undefined,
        };
      })
      .filter(Boolean) as Array<{
        prizeId: Id<"prizes">;
        teamId: Id<"teams">;
        placement?: number;
        notes?: string;
      }>;

    if (winners.length === 0) {
      toast.error("Select at least one prize winner.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        eventId,
        winners,
      });
      toast.success("Prize winners saved");
      setSavedByPrize({ ...selectedByPrize });
      setSavedNotesByPrize({ ...notesByPrize });
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save prize winners");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved winner selections. Discard changes and close?"
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3.5 h-3.5 inline-block ml-1 opacity-0 group-hover:opacity-40 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="w-3.5 h-3.5 inline-block ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 inline-block ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
      <div className="w-full h-full flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors z-10"
          aria-label="Close Winner Wizard"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="bg-muted/10 border-b border-border px-6 py-5 pr-16 space-y-3 shrink-0">
          <h2 className="text-2xl font-heading font-bold text-foreground">
            Prize Winner Wizard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assign one winner per prize. {assignedCount}/{prizes.length} assigned.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion</span>
              <span className="font-medium text-foreground">{completionPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          {prizes.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No prizes configured yet.
            </div>
          )}

          {prizes.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
              <aside className="rounded-lg border border-border bg-card overflow-hidden h-fit lg:sticky lg:top-4">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Prize Queue
                  </p>
                  <div className="mt-2">
                    <select
                      value={sponsorFilter}
                      onChange={(e) => {
                        setSponsorFilter(e.target.value);
                        setCurrentPrizeIndex(0);
                      }}
                      className="input w-full"
                    >
                      <option value="">All sponsors</option>
                      {sponsorOptions.map((sponsorName) => (
                        <option key={sponsorName} value={sponsorName}>
                          {sponsorName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="max-h-[55vh] overflow-y-auto divide-y divide-border">
                  {visiblePrizes.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">
                      No prizes match this sponsor filter.
                    </div>
                  )}
                  {visiblePrizes.map((entry: any, index: number) => {
                    const prizeId = String(entry.prize._id);
                    const isSelected = index === currentPrizeIndex;
                    const isAssigned = !!selectedByPrize[prizeId];
                    return (
                      <button
                        key={prizeId}
                        type="button"
                        onClick={() => setCurrentPrizeIndex(index)}
                        className={`w-full px-4 py-3 text-left transition-colors ${isSelected
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-muted/20 border-l-2 border-l-transparent"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {index + 1}. {entry.prize.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(entry.candidates || []).length} candidates
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-medium ${isAssigned
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300"
                              }`}
                          >
                            {isAssigned ? "Done" : "Open"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="min-w-0 rounded-lg border border-border bg-card p-4 space-y-4">
                {currentEntry && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-xl font-heading font-bold text-foreground">
                          {currentPrizeIndex + 1}. {currentEntry.prize.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {PRIZE_TYPE_LABELS[currentEntry.prize.type as PrizeType]}
                          {currentEntry.prize.track ? ` · Track: ${currentEntry.prize.track}` : ""}
                          {currentEntry.prize.sponsorName
                            ? ` · Sponsor: ${currentEntry.prize.sponsorName}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {(currentEntry.candidates || []).length} candidates
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsFilterDrawerOpen(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted/20 hover:bg-muted/40 text-xs font-medium text-foreground transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          Filters
                          {activeFilterCount > 0 && (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
                              {activeFilterCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {currentEntry.prize.description && (
                      <p className="text-sm text-muted-foreground">
                        {currentEntry.prize.description}
                      </p>
                    )}

                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                      <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-max text-left">
                          <thead className="bg-muted/30 border-b border-border">
                            <tr>
                              <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground sticky left-0 z-20 bg-card shadow-[1px_0_0_0_var(--border)] w-[100px] min-w-[100px] max-w-[100px]">
                                Pick
                              </th>
                              <th className="px-4 py-3 sticky left-[100px] z-20 bg-card shadow-[1px_0_0_0_var(--border)]">
                                <button
                                  type="button"
                                  onClick={() => handleSort("name")}
                                  className="group flex items-center text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                                >
                                  Team
                                  <SortIcon field="name" />
                                </button>
                              </th>
                              <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                Track
                              </th>
                              <th className="px-4 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleSort("score")}
                                  className="group flex items-center text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Avg Score
                                  <SortIcon field="score" />
                                </button>
                              </th>
                              <th className="px-4 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleSort("judges")}
                                  className="group flex items-center text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Judges
                                  <SortIcon field="judges" />
                                </button>
                              </th>
                              {scoreHintCategories.map((catName: string) => (
                                <th key={catName} className="px-4 py-3 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleSort(`cat_${catName}`)}
                                    className="group flex items-center text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {catName}
                                    <SortIcon field={`cat_${catName}`} />
                                  </button>
                                </th>
                              ))}
                              <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                Devpost
                              </th>
                              <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                GitHub
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredCandidates.length === 0 && (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                                >
                                  No candidates match these filters.
                                </td>
                              </tr>
                            )}
                            {filteredCandidates.map((candidate: any) => {
                              const isSelected = selectedTeamId === String(candidate.teamId);
                              const categoryAverages =
                                categoryAveragesByTeamId.get(String(candidate.teamId)) || {};
                              const visibleCategories = scoreHintCategories.slice(0, 4);
                              const hiddenCategoryCount = Math.max(
                                scoreHintCategories.length - visibleCategories.length,
                                0
                              );
                              return (
                                <tr
                                  key={`${currentPrizeId}-${candidate.teamId}`}
                                  className={`transition-colors ${isSelected ? "bg-emerald-500/10" : "hover:bg-muted/20"
                                    }`}
                                >
                                  <td className="px-4 py-3 sticky left-0 z-20 bg-card shadow-[1px_0_0_0_var(--border)] w-[100px] min-w-[100px] max-w-[100px]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedByPrize((prev) => ({
                                          ...prev,
                                          [currentPrizeId]: String(candidate.teamId),
                                        }))
                                      }
                                      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${isSelected
                                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                      {isSelected ? "Selected" : "Select"}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-[100px] z-20 bg-card shadow-[1px_0_0_0_var(--border)] whitespace-nowrap">
                                    {candidate.teamName}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                    {candidate.track || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-mono text-foreground whitespace-nowrap">
                                    {Number(candidate.averageScore || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                    {candidate.judgeCount}
                                  </td>
                                  {scoreHintCategories.map((catName: string) => (
                                    <td key={catName} className="px-4 py-3 text-sm font-mono text-muted-foreground whitespace-nowrap group-hover:text-foreground transition-colors">
                                      {categoryAverages[catName] !== undefined
                                        ? Number(categoryAverages[catName]).toFixed(2)
                                        : "-"}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {candidate.devpostUrl ? (
                                      <a
                                        href={candidate.devpostUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                      >
                                        Open
                                      </a>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {candidate.githubUrl ? (
                                      <a
                                        href={candidate.githubUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                      >
                                        Open
                                      </a>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notesByPrize[currentPrizeId] || ""}
                        onChange={(e) =>
                          setNotesByPrize((prev) => ({
                            ...prev,
                            [currentPrizeId]: e.target.value,
                          }))
                        }
                        className="input h-auto resize-y"
                        rows={3}
                        placeholder="Decision notes"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPrizeIndex((prev) => Math.max(0, prev - 1))}
                        disabled={currentPrizeIndex === 0}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous Prize
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPrizeIndex((prev) =>
                            Math.min(visiblePrizes.length - 1, prev + 1)
                          )
                        }
                        disabled={currentPrizeIndex >= visiblePrizes.length - 1}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next Prize
                      </button>
                    </div>
                  </>
                )}
                {!currentEntry && (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Select a sponsor filter with matching prizes to continue.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur flex gap-3">
          <button onClick={handleClose} className="flex-1 btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Winners"}
          </button>
        </div>
      </div>

      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div
            className="absolute inset-0 bg-background/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsFilterDrawerOpen(false)}
          />
          <div className="relative w-full max-w-sm h-full bg-card shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/10">
              <div className="space-y-0.5">
                <h3 className="text-lg font-heading font-bold text-foreground">Filters</h3>
                <p className="text-xs text-muted-foreground">{activeFilterCount} active filters</p>
              </div>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="flex flex-col gap-4">
                {activeFilterCount > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveFilters([])}
                      className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {activeFilters.length > 0 ? (
                    activeFilters.map((filter, index) => (
                      <div
                        key={filter.id}
                        className="flex flex-col gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 relative group"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const newFilters = activeFilters.filter((f) => f.id !== filter.id);
                            setActiveFilters(newFilters);
                          }}
                          className="absolute -top-2 -right-2 p-1.5 bg-background border border-border rounded-full text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                          title="Remove filter"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Field</label>
                          <select
                            value={filter.field}
                            onChange={(e) => {
                              const newFilters = [...activeFilters];
                              newFilters[index].field = e.target.value;
                              newFilters[index].value = "";
                              setActiveFilters(newFilters);
                            }}
                            className="input w-full shadow-none bg-background py-1.5 text-sm"
                          >
                            <option value="" disabled>Select filter...</option>
                            <option value="track">Track</option>
                            <option value="min_score">Overall Min Score</option>
                            <option value="min_judges">Min Judges Count</option>
                            {categories.map((cat: string) => (
                              <option key={`category_${cat}`} value={`category_${cat}`}>
                                Category: {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Condition</label>
                          {filter.field === "track" ? (
                            <select
                              value={filter.value}
                              onChange={(e) => {
                                const newFilters = [...activeFilters];
                                newFilters[index].value = e.target.value;
                                setActiveFilters(newFilters);
                              }}
                              className="input w-full shadow-none bg-background py-1.5 text-sm"
                            >
                              <option value="" disabled>Select track...</option>
                              {trackOptions.map((track) => (
                                <option key={track} value={track}>
                                  {track}
                                </option>
                              ))}
                            </select>
                          ) : filter.field === "min_judges" ? (
                            <input
                              type="number"
                              value={filter.value}
                              onChange={(e) => {
                                const newFilters = [...activeFilters];
                                newFilters[index].value = e.target.value;
                                setActiveFilters(newFilters);
                              }}
                              className="input w-full shadow-none bg-background py-1.5 text-sm"
                              min={1}
                              step={1}
                              placeholder="Enter min judges count..."
                            />
                          ) : filter.field ? (
                            <input
                              type="number"
                              value={filter.value}
                              onChange={(e) => {
                                const newFilters = [...activeFilters];
                                newFilters[index].value = e.target.value;
                                setActiveFilters(newFilters);
                              }}
                              className="input w-full shadow-none bg-background py-1.5 text-sm"
                              min={0}
                              step={0.1}
                              placeholder="Enter min score..."
                            />
                          ) : (
                            <div className="w-full h-[34px] rounded-md border border-dashed border-border/50 bg-background/50 flex items-center px-3 text-sm text-muted-foreground/50">
                              Select a field first
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 border border-dashed text-sm text-muted-foreground bg-muted/10 rounded-xl border-border/60">
                      No active filters. Adjust your view to refine candidates.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilters([
                        ...activeFilters,
                        { id: crypto.randomUUID(), field: "", value: "" },
                      ]);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors py-2.5 rounded-lg border border-emerald-500/20"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Filter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

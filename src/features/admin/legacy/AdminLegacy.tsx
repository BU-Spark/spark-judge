import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  useState,
  useEffect,
  useMemo,
  Dispatch,
  SetStateAction,
  type ComponentProps,
} from "react";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "../../../components/ui/LoadingState";
import { ErrorState } from "../../../components/ui/ErrorState";
import {
  BarChartIcon,
  LightbulbIcon,
  MedalIcon,
  TrophyIcon,
} from "../../../components/ui/AppIcons";
import { DEFAULT_DEMO_DAY_COURSES } from "../../../lib/constants";
import { formatDateTime } from "../../../lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DetailsTab } from "../tabs/DetailsTab";
import { TeamsTab } from "../tabs/TeamsTab";
import { ScoresTab } from "../tabs/ScoresTab";
import { PrizesTab } from "../tabs/PrizesTab";
import { WinnersSummaryTab } from "../tabs/WinnersSummaryTab";
import { EventsList as WorkspaceEventsList } from "../components/EventsList";
import { ScoringDashboard as WorkspaceScoringDashboard } from "../components/ScoringDashboard";
import { AddTeamPanel } from "../panels/AddTeamPanel";
import { DemoDayWinnersPanel } from "../panels/DemoDayWinnersPanel";
import { PrizeWinnerWizardPanel } from "../panels/PrizeWinnerWizardPanel";

import type { EventManagementTab, ScoresView as ScoresSubview } from "../types";

export type { EventManagementTab, ScoresSubview };
type PrizeType = "general" | "track" | "sponsor" | "track_sponsor";
type PrizeScoreBasis = "overall" | "categories" | "none";
type PrizeDraft = {
  prizeId?: Id<"prizes">;
  name: string;
  description: string;
  type: PrizeType;
  track: string;
  sponsorName: string;
  scoreBasis: PrizeScoreBasis;
  scoreCategoryNames: string[];
  isActive: boolean;
  sortOrder: number;
};

const PRIZE_TYPE_LABELS: Record<PrizeType, string> = {
  general: "General",
  track: "Track",
  sponsor: "Sponsor",
  track_sponsor: "Track + Sponsor",
};

const PRIZE_SCORE_LABELS: Record<PrizeScoreBasis, string> = {
  overall: "Overall score",
  categories: "Specific categories",
  none: "No score hint",
};

function createPrizeDraft(
  sortOrder: number,
  overrides?: Partial<PrizeDraft>
): PrizeDraft {
  return {
    name: "",
    description: "",
    type: "general",
    track: "",
    sponsorName: "",
    scoreBasis: "none",
    scoreCategoryNames: [],
    isActive: true,
    sortOrder,
    ...overrides,
  };
}

function normalizePrizeDraftsForSave(prizes: PrizeDraft[]) {
  return prizes
    .map((prize, index) => ({
      prizeId: prize.prizeId,
      name: prize.name.trim(),
      description: prize.description.trim() || undefined,
      type: prize.type,
      track: prize.track.trim() || undefined,
      sponsorName: prize.sponsorName.trim() || undefined,
      scoreBasis: prize.scoreBasis,
      scoreCategoryNames:
        prize.scoreBasis === "categories"
          ? prize.scoreCategoryNames.filter(Boolean)
          : undefined,
      isActive: prize.isActive,
      sortOrder: prize.sortOrder ?? index,
    }))
    .filter((prize) => prize.name.length > 0);
}

function formatDateTimeInput(timestamp: number) {
  const date = new Date(timestamp);
  // Convert to local time for datetime-local input
  const offset = date.getTimezoneOffset();
  const local = new Date(timestamp - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function StyledCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className = "",
  labelClassName = "",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${checked ? "border-primary bg-primary" : "border-border bg-background"
          }`}
      >
        <svg
          className={`h-3 w-3 text-white transition-opacity ${checked ? "opacity-100" : "opacity-0"
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      {label ? <span className={labelClassName}>{label}</span> : null}
    </label>
  );
}

function clampSteppedValue(
  rawValue: number,
  min: number | undefined,
  max: number | undefined,
  step: number
) {
  const safeStep = step > 0 ? step : 1;
  const minValue = typeof min === "number" ? min : Number.NEGATIVE_INFINITY;
  const maxValue = typeof max === "number" ? max : Number.POSITIVE_INFINITY;
  const initial = Number.isFinite(rawValue) ? rawValue : minValue;
  const clamped = Math.max(minValue, Math.min(maxValue, initial));
  const snapped = Math.round(clamped / safeStep) * safeStep;
  const decimals = safeStep.toString().includes(".")
    ? safeStep.toString().split(".")[1].length
    : 0;
  return Number(snapped.toFixed(decimals));
}

function StyledNumberInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled = false,
  placeholder,
  inputClassName = "",
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
}) {
  const applyValue = (nextValue: number) => {
    onValueChange(clampSteppedValue(nextValue, min, max, step));
  };

  const atMin = typeof min === "number" ? value <= min : false;
  const atMax = typeof max === "number" ? value >= max : false;

  return (
    <div className="relative">
      <input
        type="number"
        required
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => applyValue(parseFloat(e.target.value))}
        className={`input w-full pr-10 [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${inputClassName}`}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className="absolute inset-y-1 right-1 flex w-7 flex-col overflow-hidden rounded border border-border bg-muted/40">
        <button
          type="button"
          onClick={() => applyValue(value + step)}
          className="flex-1 border-b border-border text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Increase value"
          disabled={disabled || atMax}
        >
          <svg className="mx-auto h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => applyValue(value - step)}
          className="flex-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Decrease value"
          disabled={disabled || atMin}
        >
          <svg className="mx-auto h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PrizeCatalogEditor({
  prizes,
  setPrizes,
  categories,
  tracks,
  disabled = false,
}: {
  prizes: PrizeDraft[];
  setPrizes: Dispatch<SetStateAction<PrizeDraft[]>>;
  categories: string[];
  tracks: string[];
  disabled?: boolean;
}) {
  const [selectedPrizeIndex, setSelectedPrizeIndex] = useState(0);

  useEffect(() => {
    if (prizes.length === 0) {
      setSelectedPrizeIndex(0);
      return;
    }
    if (selectedPrizeIndex > prizes.length - 1) {
      setSelectedPrizeIndex(prizes.length - 1);
    }
  }, [prizes.length, selectedPrizeIndex]);

  const selectedPrize = prizes[selectedPrizeIndex];
  const activePrizeCount = prizes.filter((prize) => prize.isActive).length;

  const typeBadgeClass: Record<PrizeType, string> = {
    general: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    track: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    sponsor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    track_sponsor: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  };

  const prizeDescriptor = (prize: PrizeDraft) => {
    if (prize.type === "track" || prize.type === "track_sponsor") {
      return prize.track?.trim() || "No track";
    }
    if (prize.type === "sponsor") {
      return prize.sponsorName?.trim() || "No sponsor";
    }
    return "All teams";
  };

  const updatePrize = (index: number, updater: (item: PrizeDraft) => PrizeDraft) => {
    setPrizes((prev) =>
      prev.map((prize, prizeIndex) =>
        prizeIndex === index ? updater(prize) : prize
      )
    );
  };

  const addPrize = () => {
    setPrizes((prev) => [
      ...prev,
      createPrizeDraft(prev.length, { name: `Prize ${prev.length + 1}` }),
    ]);
    setSelectedPrizeIndex(prizes.length);
  };

  const removePrize = (index: number) => {
    setPrizes((prev) =>
      prev
        .filter((_, prizeIndex) => prizeIndex !== index)
        .map((prize, prizeIndex) => ({ ...prize, sortOrder: prizeIndex }))
    );
    setSelectedPrizeIndex((current) => {
      if (current === index) return Math.max(0, current - 1);
      if (current > index) return current - 1;
      return current;
    });
  };

  const movePrize = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= prizes.length) return;

    setPrizes((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy.map((prize, idx) => ({ ...prize, sortOrder: idx }));
    });
    setSelectedPrizeIndex((current) => {
      if (current === fromIndex) return toIndex;
      if (fromIndex < current && current <= toIndex) return current - 1;
      if (toIndex <= current && current < fromIndex) return current + 1;
      return current;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure the prizes teams can submit to.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
              {prizes.length} total
            </span>
            <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-teal-700 dark:text-teal-300">
              {activePrizeCount} active
            </span>
            <span className="inline-flex items-center rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2.5 py-1 text-zinc-700 dark:text-zinc-300">
              {Math.max(prizes.length - activePrizeCount, 0)} inactive
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={addPrize}
          disabled={disabled}
          className="btn-secondary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          + Add Prize
        </button>
      </div>

      {prizes.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No prizes yet. Add at least one prize to run award-based judging.
        </div>
      )}

      {prizes.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(24rem,28rem)_1fr] gap-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prize List</p>
            </div>
            <div className="max-h-[30rem] overflow-y-auto divide-y divide-border">
              {prizes.map((prize, index) => {
                const isSelected = selectedPrizeIndex === index;
                return (
                  <button
                    key={`${prize.prizeId || "new"}-${index}`}
                    type="button"
                    onClick={() => setSelectedPrizeIndex(index)}
                    className={`w-full px-4 py-3 text-left transition-colors ${isSelected
                      ? "bg-teal-500/10 border-l-2 border-l-teal-500"
                      : "hover:bg-muted/20 border-l-2 border-l-transparent"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {index + 1}. {prize.name.trim() || `Untitled Prize ${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {prizeDescriptor(prize)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${typeBadgeClass[prize.type]}`}
                        >
                          {PRIZE_TYPE_LABELS[prize.type]}
                        </span>
                        {!prize.isActive && (
                          <span className="text-[11px] text-muted-foreground">Inactive</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {!selectedPrize ? (
              <p className="text-sm text-muted-foreground">
                Select a prize to edit details.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPrize.name.trim() || `Prize ${selectedPrizeIndex + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Order #{selectedPrize.sortOrder + 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => movePrize(selectedPrizeIndex, selectedPrizeIndex - 1)}
                      disabled={disabled || selectedPrizeIndex === 0}
                      className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => movePrize(selectedPrizeIndex, selectedPrizeIndex + 1)}
                      disabled={disabled || selectedPrizeIndex === prizes.length - 1}
                      className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removePrize(selectedPrizeIndex)}
                      disabled={disabled}
                      className="btn-ghost text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      type="text"
                      value={selectedPrize.name}
                      onChange={(e) =>
                        updatePrize(selectedPrizeIndex, (item) => ({
                          ...item,
                          name: e.target.value,
                        }))
                      }
                      className="input"
                      disabled={disabled}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <select
                      value={selectedPrize.type}
                      onChange={(e) =>
                        updatePrize(selectedPrizeIndex, (item) => ({
                          ...item,
                          type: e.target.value as PrizeType,
                        }))
                      }
                      className="input"
                      disabled={disabled}
                    >
                      {(Object.keys(PRIZE_TYPE_LABELS) as PrizeType[]).map((type) => (
                        <option key={type} value={type}>
                          {PRIZE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(selectedPrize.type === "track" || selectedPrize.type === "track_sponsor") && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Track</label>
                      <select
                        value={selectedPrize.track}
                        onChange={(e) =>
                          updatePrize(selectedPrizeIndex, (item) => ({
                            ...item,
                            track: e.target.value,
                          }))
                        }
                        className="input"
                        disabled={disabled}
                      >
                        <option value="">Select track...</option>
                        {tracks.map((track) => (
                          <option key={track} value={track}>
                            {track}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(selectedPrize.type === "sponsor" || selectedPrize.type === "track_sponsor") && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Sponsor</label>
                      <input
                        type="text"
                        value={selectedPrize.sponsorName}
                        onChange={(e) =>
                          updatePrize(selectedPrizeIndex, (item) => ({
                            ...item,
                            sponsorName: e.target.value,
                          }))
                        }
                        className="input"
                        placeholder="Sponsor name"
                        disabled={disabled}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Score Hint</label>
                    <select
                      value={selectedPrize.scoreBasis}
                      onChange={(e) =>
                        updatePrize(selectedPrizeIndex, (item) => ({
                          ...item,
                          scoreBasis: e.target.value as PrizeScoreBasis,
                          scoreCategoryNames:
                            e.target.value === "categories" ? item.scoreCategoryNames : [],
                        }))
                      }
                      className="input"
                      disabled={disabled}
                    >
                      {(Object.keys(PRIZE_SCORE_LABELS) as PrizeScoreBasis[]).map((basis) => (
                        <option key={basis} value={basis}>
                          {PRIZE_SCORE_LABELS[basis]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedPrize.scoreBasis === "categories" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Use categories for this prize
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {categories.map((category) => {
                        const checked = selectedPrize.scoreCategoryNames.includes(category);
                        return (
                          <StyledCheckbox
                            key={`${selectedPrize.prizeId || selectedPrizeIndex}-${category}`}
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              updatePrize(selectedPrizeIndex, (item) => {
                                const next = isChecked
                                  ? [...item.scoreCategoryNames, category]
                                  : item.scoreCategoryNames.filter((name) => name !== category);
                                return { ...item, scoreCategoryNames: next };
                              });
                            }}
                            disabled={disabled}
                            className="rounded-md border border-border px-3 py-1.5"
                            labelClassName="text-xs text-foreground"
                            label={category}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <textarea
                    value={selectedPrize.description}
                    onChange={(e) =>
                      updatePrize(selectedPrizeIndex, (item) => ({
                        ...item,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="input h-auto resize-y"
                    placeholder="What this prize recognizes."
                    disabled={disabled}
                  />
                </div>

                <StyledCheckbox
                  checked={selectedPrize.isActive}
                  onCheckedChange={(isChecked) =>
                    updatePrize(selectedPrizeIndex, (item) => ({
                      ...item,
                      isActive: isChecked,
                    }))
                  }
                  disabled={disabled}
                  label="Prize is active"
                  labelClassName="text-sm text-foreground"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const navigate = useNavigate();

  // Show loading state while checking admin status
  if (isAdmin === undefined) {
    return <LoadingState label="Verifying admin access..." />;
  }

  // Show error if user is not an admin
  if (!isAdmin) {
    return (
      <ErrorState
        title="Access denied"
        description="You need admin privileges to access this dashboard."
        actionLabel="Back to events"
        onAction={onBackToLanding}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {isCreateOpen ? (
        <div className="fade-in space-y-6">
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="flex items-center gap-2 btn-ghost"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Create Event</h1>
          </div>

          <CreateEventWorkspace onClose={() => setIsCreateOpen(false)} />
        </div>
      ) : (
        <>
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 btn-ghost mb-6 fade-in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Events
          </button>

          <div className="flex justify-between items-center mb-8 fade-in">
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage your hackathon events and teams</p>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Event
            </button>
          </div>

          <EventsList
            onSelectEvent={(eventId) => {
              void navigate(`/admin/events/${eventId}`);
            }}
          />
        </>
      )}
    </div>
  );
}

export function AdminEventDetailsPage({
  eventId,
  onBackToDashboard,
}: {
  eventId: Id<"events">;
  onBackToDashboard: () => void;
}) {
  const [searchParams] = useSearchParams();
  const isAdmin = useQuery(api.events.isUserAdmin);
  const initialTabParam = searchParams.get("tab");
  const initialTab: EventManagementTab | undefined =
    initialTabParam === "details" || initialTabParam === "teams" || initialTabParam === "scores"
      ? initialTabParam
      : undefined;

  if (isAdmin === undefined) {
    return <LoadingState label="Verifying admin access..." />;
  }

  if (!isAdmin) {
    return (
      <ErrorState
        title="Access denied"
        description="You need admin privileges to access this event."
        actionLabel="Back to admin"
        onAction={onBackToDashboard}
      />
    );
  }

  return (
    <EventManagementModal
      eventId={eventId}
      onClose={onBackToDashboard}
      layout="page"
      initialTab={initialTab}
    />
  );
}

export function AdminPrizeWinnersPage({
  eventId,
  onBackToEvent,
}: {
  eventId: Id<"events">;
  onBackToEvent: () => void;
}) {
  const isAdmin = useQuery(api.events.isUserAdmin);
  const event = useQuery(api.events.getEvent, { eventId });
  const prizeDeliberationData = useQuery(api.prizes.getPrizeDeliberationData, { eventId });
  const prizeWinners = useQuery(api.prizes.listPrizeWinners, { eventId });
  const detailedScores = useQuery(api.scores.getDetailedEventScores, { eventId });
  const setPrizeWinners = useMutation(api.prizes.setPrizeWinners);
  const setWinners = useMutation(api.scores.setWinners);

  if (isAdmin === undefined || event === undefined) {
    return <LoadingState label="Loading winner wizard..." />;
  }

  if (!isAdmin) {
    return (
      <ErrorState
        title="Access denied"
        description="You need admin privileges to manage winners."
        actionLabel="Back to admin"
        onAction={onBackToEvent}
      />
    );
  }

  if (!event) {
    return (
      <ErrorState
        title="Event not found"
        description="This event could not be loaded."
        actionLabel="Back to event"
        onAction={onBackToEvent}
      />
    );
  }

  const isDemoDayMode = event.mode === "demo_day";

  return (
    <div className="mx-auto w-full h-[calc(100dvh-5rem)] md:h-[calc(100dvh-4.5rem)] min-h-0 overflow-hidden px-4 sm:px-6 lg:px-8 pt-2 pb-2 fade-in flex flex-col gap-2">
      <button
        type="button"
        onClick={onBackToEvent}
        className="flex items-center gap-2 btn-ghost shrink-0"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Event Scores
      </button>

      <div className="flex-1 min-h-0">
        {isDemoDayMode ? (
          event.teams.length > 0 ? (
            <DemoDayWinnersPanel
              eventId={eventId}
              teams={event.teams}
              categories={event.categories.map((c) => c.name)}
              onClose={onBackToEvent}
              onSubmit={setWinners}
            />
          ) : (
            <div className="card-static p-6 bg-card text-muted-foreground">
              Add teams first, then select winners.
            </div>
          )
        ) : prizeWinners === undefined || detailedScores === undefined || prizeDeliberationData === undefined ? (
          <LoadingState label="Preparing winner wizard..." />
        ) : (
          <PrizeWinnerWizardPanel
            eventId={eventId}
            deliberationData={prizeDeliberationData}
            existingWinners={prizeWinners || []}
            detailedScores={detailedScores}
            onClose={onBackToEvent}
            onSubmit={setPrizeWinners}
          />
        )}
      </div>
    </div>
  );
}

export function EventsList({ onSelectEvent }: { onSelectEvent: (eventId: Id<"events">) => void }) {
  return <WorkspaceEventsList onSelectEvent={onSelectEvent} />;
}

export function CreateEventWorkspace({ onClose }: { onClose: () => void }) {
  const createEvent = useMutation(api.events.createEvent);
  const saveEventPrizes = useMutation(api.prizes.saveEventPrizes);
  const [submitting, setSubmitting] = useState(false);
  const [useTracksAsAwards, setUseTracksAsAwards] = useState(true);
  const [categories, setCategories] = useState([
    { name: "Innovation", weight: 1, optOutAllowed: false },
    { name: "Technical Complexity", weight: 1, optOutAllowed: false },
    { name: "Design", weight: 1, optOutAllowed: false },
    { name: "Presentation", weight: 1, optOutAllowed: false },
    { name: "Impact", weight: 1, optOutAllowed: false },
  ]);
  const [prizes, setPrizes] = useState<PrizeDraft[]>([
    createPrizeDraft(0, {
      name: "Best Overall",
      type: "general",
      scoreBasis: "overall",
    }),
  ]);
  const [courseCodes, setCourseCodes] = useState<string[]>([...DEFAULT_DEMO_DAY_COURSES]);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    tracks: "AI/ML,Web Development,Hardware,Mobile,Other",
    judgeCode: "",
    enableCohorts: false,
    mode: "hackathon" as "hackathon" | "demo_day",
  });
  const [activeTab, setActiveTab] = useState<"details" | "teams" | "prizes" | "scores">("details");

  const getTimestamp = (value: string) => {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : null;
  };

  const startTimestamp = useMemo(
    () => getTimestamp(formData.startDate),
    [formData.startDate]
  );

  const endTimestamp = useMemo(
    () => getTimestamp(formData.endDate),
    [formData.endDate]
  );

  const derivedStatus = useMemo(() => {
    if (startTimestamp === null || endTimestamp === null) return null;
    if (startTimestamp >= endTimestamp) return null;
    const now = Date.now();
    if (now < startTimestamp) return "upcoming";
    if (now > endTimestamp) return "past";
    return "active";
  }, [startTimestamp, endTimestamp]);

  const hasInvalidRange = useMemo(
    () =>
      startTimestamp !== null &&
      endTimestamp !== null &&
      startTimestamp >= endTimestamp,
    [startTimestamp, endTimestamp]
  );

  const statusBadgeClass = useMemo(() => {
    switch (derivedStatus) {
      case "active":
        return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
      case "past":
        return "bg-orange-500/15 text-orange-500 border-orange-500/30";
      case "upcoming":
        return "bg-blue-500/15 text-blue-500 border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  }, [derivedStatus]);

  const statusBadgeLabel = useMemo(() => {
    if (!derivedStatus) return null;
    if (derivedStatus === "active") return "Active (happening now)";
    if (derivedStatus === "past") return "Past (already ended)";
    return "Upcoming (scheduled)";
  }, [derivedStatus]);

  const derivedCategoryNames = useMemo(
    () =>
      categories
        .map((category) => category.name.trim())
        .filter(Boolean),
    [categories]
  );

  const derivedTracks = useMemo(() => {
    if (useTracksAsAwards) return derivedCategoryNames;
    return formData.tracks
      .split(",")
      .map((track) => track.trim())
      .filter(Boolean);
  }, [useTracksAsAwards, derivedCategoryNames, formData.tracks]);

  const handleAddCourseCode = () => {
    const code = newCourseCode.trim().toUpperCase();
    if (code && !courseCodes.includes(code)) {
      setCourseCodes([...courseCodes, code]);
      setNewCourseCode("");
    }
  };

  const handleRemoveCourseCode = (code: string) => {
    setCourseCodes(courseCodes.filter((c) => c !== code));
  };

  const setCategoryWeight = (index: number, value: number) => {
    const clamped = Math.max(0, Math.min(2, Number.isFinite(value) ? value : 0));
    const rounded = Math.round(clamped * 10) / 10;
    const newCats = [...categories];
    newCats[index].weight = rounded;
    setCategories(newCats);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error("Event name is required.");
      setSubmitting(false);
      return;
    }

    const trimmedDescription = formData.description.trim();
    if (!trimmedDescription) {
      toast.error("Description is required.");
      setSubmitting(false);
      return;
    }

    const startMs = startTimestamp ?? getTimestamp(formData.startDate);
    const endMs = endTimestamp ?? getTimestamp(formData.endDate);

    if (startMs === null || endMs === null) {
      toast.error("Please provide both start and end date/time.");
      setSubmitting(false);
      return;
    }

    if (startMs >= endMs) {
      toast.error("End time must be after the start time.");
      setSubmitting(false);
      return;
    }

    const cleanedCategories = categories
      .map((cat) => ({
        name: cat.name.trim(),
        weight: Math.min(2, Math.max(0, Number(cat.weight) || 0)),
        optOutAllowed: cat.optOutAllowed ?? false,
      }))
      .filter((cat) => cat.name.length > 0);

    if (cleanedCategories.length === 0) {
      toast.error("Add at least one judging category with a name.");
      setSubmitting(false);
      return;
    }

    const parsedTracks = formData.tracks
      .split(",")
      .map((track) => track.trim())
      .filter(Boolean);

    if (formData.mode === "hackathon" && !useTracksAsAwards && parsedTracks.length === 0) {
      toast.error("Add at least one track or use award categories as tracks.");
      setSubmitting(false);
      return;
    }

    const preparedPrizes =
      formData.mode === "hackathon"
        ? normalizePrizeDraftsForSave(prizes)
        : [];

    if (formData.mode === "hackathon" && preparedPrizes.length === 0) {
      toast.error("Add at least one prize for hackathon events.");
      setSubmitting(false);
      return;
    }

    const computedStatus = derivedStatus ?? "upcoming";

    try {
      const tracks = useTracksAsAwards ? undefined : parsedTracks;

      const eventId = await createEvent({
        name: trimmedName,
        description: trimmedDescription,
        status: computedStatus,
        startDate: startMs,
        endDate: endMs,
        categories: cleanedCategories,
        tracks,
        judgeCode: formData.judgeCode || undefined,
        enableCohorts: formData.enableCohorts || undefined,
        mode: formData.mode,
        courseCodes: formData.mode === "demo_day" ? courseCodes : undefined,
      });

      if (formData.mode === "hackathon") {
        try {
          await saveEventPrizes({
            eventId,
            prizes: preparedPrizes,
          });
        } catch (error: any) {
          toast.error(
            error?.message ||
            "Event created, but saving prizes failed. Re-open the event to configure prizes."
          );
          onClose();
          return;
        }
      }

      toast.success("Event created successfully!");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const isHackathonMode = formData.mode === "hackathon";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 fade-in">
      <div className="card-static border border-border bg-card">
        <div className="flex gap-1 border-b border-border px-5 pt-5">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === "details"
              ? "bg-background text-foreground border-t border-x border-border"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("teams")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === "teams"
              ? "bg-background text-foreground border-t border-x border-border"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Teams
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prizes")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === "prizes"
              ? "bg-background text-foreground border-t border-x border-border"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Prizes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scores")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === "scores"
              ? "bg-background text-foreground border-t border-x border-border"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Scores
          </button>
        </div>

        <div className="space-y-5 p-5">
          {activeTab === "details" && (
            <>
              <section className="rounded-lg border border-border bg-background p-5 space-y-4">
                <h2 className="text-lg font-heading font-semibold text-foreground">Event Mode</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mode: "hackathon" })}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${isHackathonMode
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    <TrophyIcon className="h-4 w-4" />
                    Hackathon
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mode: "demo_day" })}
                    className={`px-4 py-2.5 rounded-lg font-medium transition-all ${!isHackathonMode
                      ? "bg-pink-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    ❤️ Demo Day
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isHackathonMode
                    ? "Judges score teams by category. Configure tracks in Teams and scoring in Scores."
                    : "Attendees vote with hearts. Configure team course codes in Teams."}
                </p>
              </section>

              <section className="rounded-lg border border-border bg-background p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Event Basics</h2>
                  {statusBadgeLabel && <span className={`badge ${statusBadgeClass}`}>{statusBadgeLabel}</span>}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Event Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="HackBU Fall 2024"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="input h-auto resize-y"
                    placeholder="Boston University's premier 24-hour hackathon..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Start Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      required
                      step="900"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">End Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      required
                      step="900"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                {hasInvalidRange && <p className="text-xs text-red-500">End time must be after the start time.</p>}
              </section>
            </>
          )}

          {activeTab === "teams" && (
            <>
              {isHackathonMode ? (
                <section className="rounded-lg border border-border bg-background p-5 space-y-4">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Track Configuration</h2>
                  <StyledCheckbox
                    checked={useTracksAsAwards}
                    onCheckedChange={setUseTracksAsAwards}
                    label="Use judging categories as tracks"
                    labelClassName="text-sm text-foreground"
                  />
                  {!useTracksAsAwards && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Custom Tracks</label>
                      <input
                        type="text"
                        required
                        value={formData.tracks}
                        onChange={(e) => setFormData({ ...formData, tracks: e.target.value })}
                        className="input"
                        placeholder="AI/ML, Web Development, Hardware..."
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Current tracks: {derivedTracks.length > 0 ? derivedTracks.join(", ") : "No tracks configured yet."}
                  </p>
                </section>
              ) : (
                <section className="rounded-lg border border-border bg-background p-5 space-y-4">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Demo Day Course Codes</h2>
                  <div className="flex flex-wrap gap-2">
                    {courseCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-pink-500/10 px-3 py-1.5 text-sm font-medium text-pink-600 dark:text-pink-400"
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => handleRemoveCourseCode(code)}
                          className="transition-colors hover:text-pink-800 dark:hover:text-pink-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    {courseCodes.length === 0 && (
                      <span className="text-sm italic text-muted-foreground">No course codes added yet.</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCourseCode();
                        }
                      }}
                      className="input flex-1"
                      placeholder="Add course code (e.g., CS101)"
                    />
                    <button
                      type="button"
                      onClick={handleAddCourseCode}
                      className="rounded-lg bg-pink-500 px-4 py-2 font-medium text-white transition-colors hover:bg-pink-600"
                    >
                      Add
                    </button>
                  </div>
                </section>
              )}

              <section className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Team roster management happens after event creation in the event details page.
                </p>
              </section>
            </>
          )}

          {activeTab === "scores" && (
            <>
              {isHackathonMode ? (
                <>
                  <section className="rounded-lg border border-border bg-background p-5 space-y-4">
                    <h2 className="text-lg font-heading font-semibold text-foreground">Judge Access</h2>
                    <StyledCheckbox
                      checked={formData.enableCohorts}
                      onCheckedChange={(checked) => setFormData({ ...formData, enableCohorts: checked })}
                      label="Enable multiple judging cohorts"
                      labelClassName="text-sm text-foreground"
                    />
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        Judge Code <span className="text-muted-foreground text-xs">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.judgeCode}
                        onChange={(e) => setFormData({ ...formData, judgeCode: e.target.value })}
                        className="input"
                        placeholder="Judge code (optional)"
                      />
                    </div>
                  </section>

                  <section className="rounded-lg border border-border bg-background p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-heading font-semibold text-foreground">Judging Categories</h2>
                      <span className="text-xs text-muted-foreground">Weight range: 0-2</span>
                    </div>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <div className="min-w-[42rem]">
                          <div className="grid grid-cols-[1fr,110px,110px,40px] gap-2 border-b border-border bg-muted/20 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <span>Category</span>
                            <span>Weight</span>
                            <span className="text-center">Opt-out allowed</span>
                            <span className="text-right" aria-hidden />
                          </div>
                          <div className="space-y-2 p-3">
                            {categories.map((cat, index) => (
                              <div key={index} className="grid grid-cols-[1fr,110px,110px,40px] items-center gap-2">
                                <input
                                  type="text"
                                  required
                                  value={cat.name}
                                  onChange={(e) => {
                                    const newCats = [...categories];
                                    newCats[index].name = e.target.value;
                                    setCategories(newCats);
                                  }}
                                  className="input w-full"
                                  placeholder="e.g., Innovation"
                                />
                                <StyledNumberInput
                                  value={cat.weight}
                                  onValueChange={(nextValue) => setCategoryWeight(index, nextValue)}
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  placeholder="1.0"
                                />
                                <StyledCheckbox
                                  checked={cat.optOutAllowed ?? false}
                                  onCheckedChange={(checked) => {
                                    const newCats = [...categories];
                                    newCats[index].optOutAllowed = checked;
                                    setCategories(newCats);
                                  }}
                                  className="mx-auto"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCategories(categories.filter((_, i) => i !== index))}
                                  className="rounded-lg p-2.5 text-red-500 transition-colors hover:bg-red-500/10"
                                  aria-label={`Remove ${cat.name || "category"}`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCategories([...categories, { name: "", weight: 1, optOutAllowed: false }])}
                      className="btn-ghost text-sm"
                    >
                      + Add Category
                    </button>
                  </section>
                </>
              ) : (
                <section className="rounded-lg border border-border bg-background p-6 space-y-2">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Scoring (Demo Day)</h2>
                  <p className="text-sm text-muted-foreground">
                    Demo Day events use attendee appreciations (hearts) instead of judge score categories. No
                    additional score setup is required at creation time.
                  </p>
                </section>
              )}
            </>
          )}

          {activeTab === "prizes" && (
            <>
              {isHackathonMode ? (
                <section className="rounded-lg border border-border bg-background p-5 space-y-3">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Prize Catalog</h2>
                  <PrizeCatalogEditor
                    prizes={prizes}
                    setPrizes={setPrizes}
                    categories={derivedCategoryNames}
                    tracks={derivedTracks}
                    disabled={submitting}
                  />
                </section>
              ) : (
                <section className="rounded-lg border border-border bg-background p-6 space-y-2">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Prizes (Demo Day)</h2>
                  <p className="text-sm text-muted-foreground">
                    Demo Day events use attendee appreciations (hearts) instead of judged prizes.
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-4 z-20 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating...
              </span>
            ) : (
              "Create Event"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

export function EventManagementModal({
  eventId,
  onClose,
  layout = "page",
  initialTab = "details",
  onTabChange,
  scoresView = "overview",
  onScoresViewChange,
}: {
  eventId: Id<"events">;
  onClose: () => void;
  layout?: "modal" | "page";
  initialTab?: EventManagementTab;
  onTabChange?: (tab: EventManagementTab) => void;
  scoresView?: ScoresSubview;
  onScoresViewChange?: (view: ScoresSubview) => void;
}) {
  const navigate = useNavigate();
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });
  const detailedScores = useQuery(api.scores.getDetailedEventScores, { eventId });
  const appreciationSummary = useQuery(api.appreciations.getEventAppreciationSummary, { eventId });
  const eventPrizes = useQuery(api.prizes.listEventPrizes, { eventId });
  const prizeDeliberationData = useQuery(api.prizes.getPrizeDeliberationData, { eventId });
  const prizeWinners = useQuery(api.prizes.listPrizeWinners, { eventId });
  const updateEventDetails = useMutation(api.events.updateEventDetails);
  const updateEventCategories = useMutation(api.events.updateEventCategories);
  const updateEventCohorts = useMutation(api.events.updateEventCohorts);
  const updateEventMode = useMutation(api.events.updateEventMode);
  const updateEventStatus = useMutation(api.events.updateEventStatus);
  const duplicateEvent = useMutation(api.events.duplicateEvent);
  const removeEvent = useMutation(api.events.removeEvent);
  const createTeam = useMutation(api.teams.createTeam);
  const updateTeamAdmin = useMutation(api.teams.updateTeamAdmin);
  const setWinners = useMutation(api.scores.setWinners);
  const saveEventPrizes = useMutation(api.prizes.saveEventPrizes);
  const setPrizeWinners = useMutation(api.prizes.setPrizeWinners);
  const releaseResults = useMutation(api.scores.releaseResults);
  const setScoringLock = useMutation(api.events.setScoringLock);
  const hideTeam = useMutation(api.teams.hideTeam);
  const removeTeam = useMutation(api.teams.removeTeam);

  const generateQrZip = useAction(api.qrCodes.generateQrCodeZip);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [teamMenuOpen, setTeamMenuOpen] = useState<Id<"teams"> | null>(null);
  const [activeTab, setActiveTab] = useState<EventManagementTab>(initialTab);
  const [localScoresView, setLocalScoresView] = useState<ScoresSubview>(scoresView);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [isRemovingEvent, setIsRemovingEvent] = useState(false);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [categoriesEdit, setCategoriesEdit] = useState<Array<{ name: string; weight: number; optOutAllowed?: boolean }>>([]);
  const [enableCohorts, setEnableCohorts] = useState(false);
  const [judgeCodeEdit, setJudgeCodeEdit] = useState("");
  const [savingJudgeSettings, setSavingJudgeSettings] = useState(false);
  const [prizesEdit, setPrizesEdit] = useState<PrizeDraft[]>([]);
  const [savingPrizes, setSavingPrizes] = useState(false);
  const [lockingScores, setLockingScores] = useState(false);
  const [appreciationBudget, setAppreciationBudget] = useState<number>(100);
  const [savingAppreciationSettings, setSavingAppreciationSettings] = useState(false);

  const updateTab = (tab: EventManagementTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setLocalScoresView(scoresView);
  }, [scoresView]);

  const activeScoresView = onScoresViewChange ? scoresView : localScoresView;
  const updateScoresView = (view: ScoresSubview) => {
    if (onScoresViewChange) {
      onScoresViewChange(view);
      return;
    }
    setLocalScoresView(view);
  };

  // Sync editable fields when event changes
  useEffect(() => {
    if (event) {
      setEventName(event.name || "");
      setEventDescription(event.description || "");
      setEventStart(formatDateTimeInput(event.startDate));
      setEventEnd(formatDateTimeInput(event.endDate));
      setCategoriesEdit(
        (event.categories || []).map((cat: any) => ({
          name: typeof cat === "string" ? cat : cat.name,
          weight: typeof cat === "string" ? 1 : cat.weight ?? 1,
          optOutAllowed: typeof cat === "string" ? false : cat.optOutAllowed ?? false,
        }))
      );
      setEnableCohorts(!!event.enableCohorts);
      setJudgeCodeEdit(event.judgeCode || "");
      setAppreciationBudget(
        typeof event.appreciationBudgetPerAttendee === "number"
          ? event.appreciationBudgetPerAttendee
          : 100
      );
    }
  }, [event]);

  useEffect(() => {
    if (!eventPrizes) return;
    setPrizesEdit(
      eventPrizes.map((prize: any, index: number) =>
        createPrizeDraft(index, {
          prizeId: prize._id,
          name: prize.name || "",
          description: prize.description || "",
          type: prize.type || "general",
          track: prize.track || "",
          sponsorName: prize.sponsorName || "",
          scoreBasis: prize.scoreBasis || "none",
          scoreCategoryNames: prize.scoreCategoryNames || [],
          isActive: prize.isActive !== false,
          sortOrder: prize.sortOrder ?? index,
        })
      )
    );
  }, [eventPrizes]);

  const categoriesForPrizeEditor = useMemo(
    () => categoriesEdit.map((category) => category.name.trim()).filter(Boolean),
    [categoriesEdit]
  );
  const tracksForPrizeEditor = useMemo(() => {
    if (event?.tracks && event.tracks.length > 0) return event.tracks;
    return categoriesForPrizeEditor;
  }, [event?.tracks, categoriesForPrizeEditor]);
  const teamPrizeIdsByTeamId = useMemo(() => {
    const prizeSelections = new Map<string, string[]>();
    const prizeCards = prizeDeliberationData?.prizes;
    if (!prizeCards) return prizeSelections;

    for (const card of prizeCards) {
      const prizeId = card?.prize?._id;
      if (!prizeId) continue;

      for (const candidate of card.candidates || []) {
        const teamKey = String(candidate.teamId);
        const existing = prizeSelections.get(teamKey) || [];
        if (!existing.includes(String(prizeId))) {
          existing.push(String(prizeId));
        }
        prizeSelections.set(teamKey, existing);
      }
    }

    return prizeSelections;
  }, [prizeDeliberationData]);

  if (!event) {
    return null;
  }

  const isDemoDayMode = event.mode === "demo_day";

  const derivedStatus = (() => {
    const now = Date.now();
    if (now < event.startDate) return "upcoming";
    if (now > event.endDate) return "past";
    return "active";
  })();

  const scoresLoaded = eventScores !== undefined;
  // Treat judging as started only if any team has at least one score submitted.
  const hasScores =
    eventScores?.some(
      (teamScore) =>
        (teamScore as any)?.judgeCount > 0 ||
        ((teamScore as any)?.scores?.length || 0) > 0
    ) ?? false;
  const scoringLocked = !!event.scoringLockedAt;
  const scoringLockedLabel = event.scoringLockedAt
    ? formatDateTime(event.scoringLockedAt)
    : null;
  const isPageLayout = layout === "page";
  const canEditJudgeSettings = !hasScores && !scoringLocked;
  const hasConfiguredPrizes = (eventPrizes?.length || 0) > 0;
  const teamListContent = (
    <>
      {event.teams.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">No teams added yet</div>
      ) : (
        <div className="divide-y divide-border w-full">
          {event.teams.map((team, index) => {
            const isSelected = editingTeam?._id === team._id;
            return (
              <div
                key={team._id}
                className={`w-full px-4 py-3 text-left transition-colors relative group ${isSelected
                  ? "bg-teal-500/10 border-l-2 border-l-teal-500"
                  : "hover:bg-muted/20 border-l-2 border-l-transparent"
                  } ${(team as any).hidden ? "opacity-50" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">{team.name}</h4>
                      {(team as any).hidden && (
                        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                          Hidden
                        </span>
                      )}
                      {isDemoDayMode && (team as any).courseCode && (
                        <span className="px-2 py-0.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs rounded-full">
                          {(team as any).courseCode}
                        </span>
                      )}
                      {!isDemoDayMode && (team as any).sponsorName && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                          {(team as any).sponsorName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{team.members.join(", ")}</p>
                  </div>
                  <div className="relative ml-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeamMenuOpen(teamMenuOpen === team._id ? null : team._id);
                      }}
                      className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    {teamMenuOpen === team._id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setTeamMenuOpen(null)}
                        />
                        <div className="absolute right-0 top-8 z-20 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[150px]">
                          <button
                            onClick={() => {
                              setEditingTeam(team);
                              setShowAddTeam(true);
                              setTeamMenuOpen(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            Edit Team
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await hideTeam({ teamId: team._id, hidden: !(team as any).hidden });
                                toast.success((team as any).hidden ? "Team unhidden" : "Team hidden");
                                setTeamMenuOpen(null);
                              } catch (error: any) {
                                toast.error(error.message);
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            {(team as any).hidden ? "Unhide Team" : "Hide Team"}
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to permanently delete "${team.name}"? This will also delete all scores for this team.`)) {
                                try {
                                  await removeTeam({ teamId: team._id });
                                  toast.success("Team removed");
                                  setTeamMenuOpen(null);
                                } catch (error: any) {
                                  toast.error(error.message);
                                }
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Remove Team
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const handleModeChange = async (mode: "hackathon" | "demo_day") => {
    try {
      await updateEventMode({ eventId, mode });
      toast.success(`Event mode changed to ${mode === "demo_day" ? "Demo Day" : "Hackathon"}!`);
    } catch (error) {
      toast.error("Failed to update mode");
    }
  };

  const handleExportAppreciationsCsv = () => {
    if (!appreciationSummary) return;

    const headers = ["Team Name", "Course Code", "Total Appreciations", "Unique Attendees"];
    const rows = appreciationSummary.teams.map(team => [
      team.teamName,
      team.courseCode || "",
      team.rawScore.toString(),
      // We don't have unique attendees per team in summary, use rawScore as proxy
      team.rawScore.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${event?.name || "event"}_appreciations.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported!");
  };

  const handleDownloadQrCodes = async () => {
    if (!event) return;

    setIsGeneratingQr(true);
    try {
      // Get the current origin for building URLs
      const baseUrl = window.location.origin;

      const result = await generateQrZip({
        eventId,
        baseUrl,
      });

      if (!result.success || !result.zipBase64) {
        toast.error(result.error || "Failed to generate QR codes");
        return;
      }

      // Convert base64 to blob and download
      const binaryString = atob(result.zipBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", result.filename || "qr-codes.zip");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("QR codes downloaded!");
    } catch (error) {
      console.error("Error downloading QR codes:", error);
      toast.error("Failed to download QR codes");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!eventName.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!eventStart || !eventEnd) {
      toast.error("Start and end date/time are required");
      return;
    }

    const startMs = Date.parse(eventStart);
    const endMs = Date.parse(eventEnd);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      toast.error("Please provide valid dates");
      return;
    }

    if (endMs < startMs) {
      toast.error("End date/time must be after start date/time");
      return;
    }

    setSavingDetails(true);
    try {
      await updateEventDetails({
        eventId,
        name: eventName.trim(),
        description: eventDescription.trim(),
        startDate: startMs,
        endDate: endMs,
      });
      toast.success("Event details saved");
    } catch (error) {
      toast.error("Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveJudgeSettings = async () => {
    if (!scoresLoaded) {
      toast.error("Scores are still loading. Please try again.");
      return;
    }

    if (!canEditJudgeSettings) {
      toast.error("Judging settings are locked while scoring is in progress or locked.");
      return;
    }

    const cleanedCategories = categoriesEdit
      .map((cat) => ({
        name: cat.name.trim(),
        weight: Math.min(2, Math.max(0, Number(cat.weight) || 0)),
        optOutAllowed: cat.optOutAllowed ?? false,
      }))
      .filter((cat) => cat.name.length > 0);

    if (cleanedCategories.length === 0) {
      toast.error("Add at least one category with a name.");
      return;
    }

    setSavingJudgeSettings(true);
    try {
      await Promise.all([
        updateEventCategories({ eventId, categories: cleanedCategories }),
        updateEventCohorts({ eventId, enableCohorts }),
        updateEventDetails({
          eventId,
          judgeCode: judgeCodeEdit.trim() || null,
        }),
      ]);
      toast.success("Judging settings updated");
    } catch (error) {
      toast.error("Failed to save judging settings");
    } finally {
      setSavingJudgeSettings(false);
    }
  };

  const handleSavePrizes = async () => {
    if (isDemoDayMode) return;

    const normalizedPrizes = normalizePrizeDraftsForSave(prizesEdit);
    if (normalizedPrizes.length === 0) {
      toast.error("Add at least one active prize before saving.");
      return;
    }

    setSavingPrizes(true);
    try {
      await saveEventPrizes({
        eventId,
        prizes: normalizedPrizes,
      });
      toast.success("Prize catalog saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save prizes");
    } finally {
      setSavingPrizes(false);
    }
  };

  const handleSetScoringLock = async (locked: boolean) => {
    if (isDemoDayMode) return;
    setLockingScores(true);
    try {
      const reason = locked
        ? "Deliberation in progress"
        : "Reopened for score adjustments";
      await setScoringLock({ eventId, locked, reason });
      toast.success(locked ? "Scoring locked" : "Scoring unlocked");
      if (!locked && activeScoresView === "winners") {
        updateScoresView("overview");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update scoring lock");
    } finally {
      setLockingScores(false);
    }
  };

  const handleSaveAppreciationSettings = async () => {
    const parsed = Number(appreciationBudget);
    const budgetValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setSavingAppreciationSettings(true);
    try {
      await updateEventDetails({
        eventId,
        appreciationBudgetPerAttendee: budgetValue,
      });
      toast.success("Appreciation settings saved");
    } catch (error) {
      toast.error("Failed to save appreciation settings");
    } finally {
      setSavingAppreciationSettings(false);
    }
  };

  const handleRemoveEvent = async () => {
    const confirmed = window.confirm(
      `Remove "${event.name}"? This will delete teams, scores, and access for this event.`
    );
    if (!confirmed) return;

    try {
      setIsRemovingEvent(true);
      await removeEvent({ eventId });
      toast.success("Event removed");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove event");
    } finally {
      setIsRemovingEvent(false);
    }
  };

  const handleDuplicateEvent = async () => {
    try {
      setIsDuplicatingEvent(true);
      await duplicateEvent({ eventId });
      toast.success("Event duplicated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to duplicate event");
    } finally {
      setIsDuplicatingEvent(false);
    }
  };

  const handleStatusChange = async (status: "upcoming" | "active" | "past") => {
    try {
      await updateEventStatus({ eventId, status });
      toast.success(`Event marked as ${status}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update event status");
    }
  };

  const handleReleaseResults = async () => {
    try {
      await releaseResults({ eventId });
      toast.success("Results released!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to release results");
    }
  };

  return (
    <div
      className={
        isPageLayout
          ? "w-full h-full min-h-0 flex flex-col gap-3 overflow-hidden fade-in"
          : "fixed inset-0 z-50 flex items-center justify-center p-4"
      }
    >
      {!isPageLayout && (
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {isPageLayout && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-3 transition-colors"
                aria-label="Back to Admin Dashboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Admin Dashboard
              </button>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-heading font-bold text-foreground">{event.name}</h1>
                {isDemoDayMode && (
                  <span className="badge bg-pink-500/20 text-pink-500 border-pink-500/30">
                    Demo Day
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">Manage event settings and teams</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDuplicateEvent}
                disabled={isDuplicatingEvent}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isDuplicatingEvent
                  ? "border-blue-300 text-blue-300 cursor-not-allowed"
                  : "border-blue-500/40 text-blue-500 hover:bg-blue-500/10"
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {isDuplicatingEvent ? "Duplicating..." : "Duplicate"}
              </button>
              <button
                type="button"
                onClick={handleRemoveEvent}
                disabled={isRemovingEvent}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isRemovingEvent
                  ? "border-red-400 text-red-400 cursor-not-allowed"
                  : "border-red-500/40 text-red-500 hover:bg-red-500/10"
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isRemovingEvent ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </>
      )}
      <div
        className={`relative w-full ${isPageLayout
          ? "min-h-0 flex flex-col"
          : "bg-background rounded-2xl shadow-2xl max-w-4xl border border-border slide-up max-h-[90vh] overflow-auto"
          }`}
      >
        <div
          className={
            isPageLayout
              ? "flex-shrink-0"
              : "border-b border-border bg-background sticky top-0 z-10"
          }
        >
          {!isPageLayout && (
            <div className="p-6 pb-0">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between pr-12">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-heading font-bold text-foreground">{event.name}</h2>
                    {isDemoDayMode && (
                      <span className="badge bg-pink-500/20 text-pink-500 border-pink-500/30">
                        Demo Day
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">Manage event settings and teams</p>
                </div>
                <div className="flex items-center gap-2 flex-nowrap">
                  <button
                    type="button"
                    onClick={handleDuplicateEvent}
                    disabled={isDuplicatingEvent}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isDuplicatingEvent
                      ? "border-blue-300 text-blue-300 cursor-not-allowed"
                      : "border-blue-500/40 text-blue-500 hover:bg-blue-500/10"
                      }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {isDuplicatingEvent ? "Duplicating..." : "Duplicate"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveEvent}
                    disabled={isRemovingEvent}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isRemovingEvent
                      ? "border-red-400 text-red-400 cursor-not-allowed"
                      : "border-red-500/40 text-red-500 hover:bg-red-500/10"
                      }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {isRemovingEvent ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div
            className={
              isPageLayout
                ? "inline-flex w-fit gap-1 rounded-lg border border-border bg-card/70 p-1"
                : "flex gap-1 px-6 mt-4"
            }
          >
            <button
              onClick={() => updateTab("details")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isPageLayout
                ? activeTab === "details"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                : activeTab === "details"
                  ? "bg-background text-foreground border-t border-x border-border rounded-t-lg rounded-b-none"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Details
            </button>
            <button
              onClick={() => updateTab("teams")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isPageLayout
                ? activeTab === "teams"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                : activeTab === "teams"
                  ? "bg-background text-foreground border-t border-x border-border rounded-t-lg rounded-b-none"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Teams
            </button>
            <button
              onClick={() => updateTab("prizes")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isPageLayout
                ? activeTab === "prizes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                : activeTab === "prizes"
                  ? "bg-background text-foreground border-t border-x border-border rounded-t-lg rounded-b-none"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Prizes
            </button>
            <button
              onClick={() => updateTab("scores")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isPageLayout
                ? activeTab === "scores"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                : activeTab === "scores"
                  ? "bg-background text-foreground border-t border-x border-border rounded-t-lg rounded-b-none"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Scores
            </button>
            <button
              onClick={() => updateTab("winners")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isPageLayout
                ? activeTab === "winners"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                : activeTab === "winners"
                  ? "bg-background text-foreground border-t border-x border-border rounded-t-lg rounded-b-none"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Winners
            </button>
          </div>
        </div>

        <div
          className={
            isPageLayout
              ? "min-h-0 flex-1 overflow-hidden pt-4"
              : "p-6 space-y-6"
          }
        >
          <div className={isPageLayout ? "h-full overflow-y-auto pr-1 space-y-5" : "space-y-6"}>
            {activeTab === "details" && (
              <DetailsTab
                derivedStatus={derivedStatus}
                eventName={eventName}
                setEventName={setEventName}
                eventDescription={eventDescription}
                setEventDescription={setEventDescription}
                eventStart={eventStart}
                setEventStart={setEventStart}
                eventEnd={eventEnd}
                setEventEnd={setEventEnd}
                handleSaveDetails={handleSaveDetails}
                savingDetails={savingDetails}
                isDemoDayMode={isDemoDayMode}
                handleModeChange={handleModeChange}
                canEditJudgeSettings={canEditJudgeSettings}
                scoringLocked={scoringLocked}
                scoringLockedLabel={scoringLockedLabel}
                judgeCodeEdit={judgeCodeEdit}
                setJudgeCodeEdit={setJudgeCodeEdit}
                enableCohorts={enableCohorts}
                setEnableCohorts={setEnableCohorts}
                scoresLoaded={scoresLoaded}
                categoriesEdit={categoriesEdit}
                setCategoriesEdit={setCategoriesEdit}
                handleSaveJudgeSettings={handleSaveJudgeSettings}
                savingJudgeSettings={savingJudgeSettings}
                handleSavePrizes={handleSavePrizes}
                savingPrizes={savingPrizes}
                prizesEdit={prizesEdit}
                setPrizesEdit={setPrizesEdit}
                categoriesForPrizeEditor={categoriesForPrizeEditor}
                tracksForPrizeEditor={tracksForPrizeEditor}
                appreciationBudget={appreciationBudget}
                setAppreciationBudget={setAppreciationBudget}
                handleSaveAppreciationSettings={handleSaveAppreciationSettings}
                savingAppreciationSettings={savingAppreciationSettings}
                StyledCheckbox={StyledCheckbox}
                StyledNumberInput={StyledNumberInput}
                PrizeCatalogEditor={PrizeCatalogEditor}
                TrophyIcon={TrophyIcon}
              />
            )}

            {activeTab === "teams" && (
              <TeamsTab
                teamCount={event.teams.length}
                isPageLayout={isPageLayout}
                showAddTeam={showAddTeam}
                onOpenCreateTeam={() => {
                  setEditingTeam(null);
                  setShowAddTeam(true);
                }}
                teamListContent={teamListContent}
                addTeamPanel={
                  <AddTeamPanel
                    eventId={eventId}
                    onClose={() => {
                      setShowAddTeam(false);
                      setEditingTeam(null);
                    }}
                    onSubmit={createTeam}
                    onSubmitEdit={updateTeamAdmin}
                    editingTeam={editingTeam}
                    eventMode={event.mode}
                    tracks={tracksForPrizeEditor}
                    eventPrizes={eventPrizes}
                    prizesLoading={eventPrizes === undefined}
                    teamPrizeIdsByTeamId={teamPrizeIdsByTeamId}
                    courseCodes={event.courseCodes || []}
                  />
                }
              />
            )}

            {activeTab === "prizes" && (
              <PrizesTab
                isDemoDayMode={isDemoDayMode}
                savingPrizes={savingPrizes}
                handleSavePrizes={handleSavePrizes}
                prizesEdit={prizesEdit}
                setPrizesEdit={setPrizesEdit}
                categoriesForPrizeEditor={categoriesForPrizeEditor}
                tracksForPrizeEditor={tracksForPrizeEditor}
                scoringLocked={scoringLocked}
                PrizeCatalogEditor={PrizeCatalogEditor}
              />
            )}

            {activeTab === "scores" && (
              <ScoresTab
                isDemoDayMode={isDemoDayMode}
                eventStatus={event.status as "upcoming" | "active" | "past"}
                resultsReleased={event.resultsReleased}
                eventScores={eventScores || undefined}
                scoringLocked={scoringLocked}
                lockingScores={lockingScores}
                hasConfiguredPrizes={hasConfiguredPrizes}
                prizeDeliberationReady={!!prizeDeliberationData}
                onFinishEvent={() => void handleStatusChange("past")}
                onToggleScoringLock={() => void handleSetScoringLock(!scoringLocked)}
                onOpenWinners={() => updateScoresView("winners")}
                onReleaseResults={handleReleaseResults}
                isPageLayout={isPageLayout}
                scoresView={activeScoresView}
                onBackToScores={() => updateScoresView("overview")}
                winnersContent={
                  isDemoDayMode ? (
                    event.teams.length > 0 ? (
                      <DemoDayWinnersPanel
                        eventId={eventId}
                        teams={event.teams}
                        categories={event.categories.map((c) => c.name)}
                        onClose={() => updateScoresView("overview")}
                        onSubmit={setWinners}
                      />
                    ) : (
                      <div className="card-static p-6 bg-card text-muted-foreground">
                        Add teams first, then select winners.
                      </div>
                    )
                  ) : prizeWinners === undefined ||
                    detailedScores === undefined ||
                    prizeDeliberationData === undefined ? (
                    <LoadingState label="Preparing winner wizard..." />
                  ) : (
                    <PrizeWinnerWizardPanel
                      eventId={eventId}
                      deliberationData={prizeDeliberationData}
                      existingWinners={prizeWinners || []}
                      detailedScores={detailedScores || []}
                      onClose={() => updateScoresView("overview")}
                      onSubmit={async (args) => {
                        await setPrizeWinners(args);
                        updateScoresView("overview");
                        updateTab("winners");
                      }}
                    />
                  )
                }
                appreciationSummary={appreciationSummary}
                onExportAppreciationsCsv={handleExportAppreciationsCsv}
                onDownloadQrCodes={() => void handleDownloadQrCodes()}
                isGeneratingQr={isGeneratingQr}
                detailedScores={detailedScores}
                viewMode={viewMode}
                setViewMode={setViewMode}
                ScoringDashboard={ScoringDashboard}
                MedalIcon={MedalIcon}
                BarChartIcon={BarChartIcon}
                LightbulbIcon={LightbulbIcon}
              />
            )}
            {activeTab === "winners" && (
              <WinnersSummaryTab
                eventPrizes={eventPrizes || []}
                eventTeams={event?.teams || []}
                prizeWinners={prizeWinners || []}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type PrizeWinnerWizardPanelProps = ComponentProps<typeof PrizeWinnerWizardPanel>;

export function PrizeWinnersWizardModal({
  layout: _layout,
  ...props
}: PrizeWinnerWizardPanelProps & {
  layout?: "modal" | "inline";
}) {
  return <PrizeWinnerWizardPanel {...props} />;
}

type WorkspaceScoringDashboardProps = ComponentProps<typeof WorkspaceScoringDashboard>;

export function ScoringDashboard(props: WorkspaceScoringDashboardProps) {
  return <WorkspaceScoringDashboard {...props} />;
}

type AddTeamPanelProps = ComponentProps<typeof AddTeamPanel>;

export function AddTeamModal({
  layout: _layout,
  ...props
}: AddTeamPanelProps & {
  layout?: "modal" | "inline";
}) {
  return <AddTeamPanel {...props} />;
}

type DemoDayWinnersPanelProps = ComponentProps<typeof DemoDayWinnersPanel>;

export function SelectWinnersModal({
  layout: _layout,
  ...props
}: DemoDayWinnersPanelProps & {
  layout?: "modal" | "inline";
}) {
  return <DemoDayWinnersPanel {...props} />;
}

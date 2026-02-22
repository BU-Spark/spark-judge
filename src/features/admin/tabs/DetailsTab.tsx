import type { ReactNode } from "react";

type CategoryDraft = {
  name: string;
  weight: number;
  optOutAllowed?: boolean;
};

export function DetailsTab({
  derivedStatus,
  eventName,
  setEventName,
  eventDescription,
  setEventDescription,
  eventStart,
  setEventStart,
  eventEnd,
  setEventEnd,
  handleSaveDetails,
  savingDetails,
  isDemoDayMode,
  handleModeChange,
  canEditJudgeSettings,
  scoringLocked,
  scoringLockedLabel,
  judgeCodeEdit,
  setJudgeCodeEdit,
  enableCohorts,
  setEnableCohorts,
  scoresLoaded,
  categoriesEdit,
  setCategoriesEdit,
  handleSaveJudgeSettings,
  savingJudgeSettings,
  handleSavePrizes,
  savingPrizes,
  prizesEdit,
  setPrizesEdit,
  categoriesForPrizeEditor,
  tracksForPrizeEditor,
  tracksEdit,
  setTracksEdit,
  appreciationBudget,
  setAppreciationBudget,
  handleSaveAppreciationSettings,
  savingAppreciationSettings,
  StyledCheckbox,
  StyledNumberInput,
  PrizeCatalogEditor,
  TrophyIcon,
}: {
  derivedStatus: "active" | "upcoming" | "past";
  eventName: string;
  setEventName: (value: string) => void;
  eventDescription: string;
  setEventDescription: (value: string) => void;
  eventStart: string;
  setEventStart: (value: string) => void;
  eventEnd: string;
  setEventEnd: (value: string) => void;
  handleSaveDetails: () => void;
  savingDetails: boolean;
  isDemoDayMode: boolean;
  handleModeChange: (mode: "hackathon" | "demo_day") => void;
  canEditJudgeSettings: boolean;
  scoringLocked: boolean;
  scoringLockedLabel: string | null;
  judgeCodeEdit: string;
  setJudgeCodeEdit: (value: string) => void;
  enableCohorts: boolean;
  setEnableCohorts: (value: boolean) => void;
  scoresLoaded: boolean;
  categoriesEdit: CategoryDraft[];
  setCategoriesEdit: (value: CategoryDraft[]) => void;
  handleSaveJudgeSettings: () => void;
  savingJudgeSettings: boolean;
  handleSavePrizes: () => void;
  savingPrizes: boolean;
  prizesEdit: any[];
  setPrizesEdit: (value: any[]) => void;
  categoriesForPrizeEditor: string[];
  tracksForPrizeEditor: string[];
  tracksEdit: string;
  setTracksEdit: (value: string) => void;
  appreciationBudget: number;
  setAppreciationBudget: (value: number) => void;
  handleSaveAppreciationSettings: () => void;
  savingAppreciationSettings: boolean;
  StyledCheckbox: (props: any) => ReactNode;
  StyledNumberInput: (props: any) => ReactNode;
  PrizeCatalogEditor: (props: any) => ReactNode;
  TrophyIcon: (props: any) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(22rem,28rem)_1fr] xl:grid-cols-[minmax(24rem,32rem)_1fr] gap-6 items-start w-full">
      <div className="space-y-6 min-w-0">
        <div className="card-static p-6 bg-card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground">Event Details</h3>
                <p className="text-sm text-muted-foreground">
                  Status updates automatically from the schedule
                </p>
              </div>
            </div>
            <span
              className={`badge ${derivedStatus === "active"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : derivedStatus === "upcoming"
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                  : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                }`}
            >
              {derivedStatus.charAt(0).toUpperCase() + derivedStatus.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="input"
                placeholder="Demo Day Fall 2025"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                className="input"
                placeholder="Manage event settings and teams"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Start Date &amp; Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                className="input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                End Date &amp; Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                className="input"
              />
            </div>
            {!isDemoDayMode && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">
                  Event Tracks <span className="text-muted-foreground text-xs">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tracksEdit}
                  onChange={(e) => setTracksEdit(e.target.value)}
                  className="input"
                  placeholder="AI/ML, Web Development, Hardware..."
                />
                <p className="text-xs text-muted-foreground">
                  Tracks are used for team registration. If left empty, judging categories will be used as tracks.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveDetails}
              disabled={savingDetails}
              className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingDetails ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Details"
              )}
            </button>
          </div>
        </div>

        <div className="card-static p-6 bg-card">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Event Mode
          </h3>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => handleModeChange("hackathon")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${!isDemoDayMode
                ? "bg-primary text-white shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              <TrophyIcon className="h-4 w-4" />
              Hackathon
            </button>
            <button
              onClick={() => handleModeChange("demo_day")}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${isDemoDayMode
                ? "bg-pink-500 text-white shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              ❤️ Demo Day
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {isDemoDayMode
              ? "Public appreciation voting - attendees can give hearts to projects without signing in"
              : "Traditional judging with scores and categories - requires judge registration"}
          </p>
        </div>
      </div>

      <div className="space-y-6 min-w-0">
        {!isDemoDayMode && (
          <div className="card-static p-6 bg-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Judging Settings
              </h3>
              {!canEditJudgeSettings && (
                <span className="badge bg-amber-500/15 text-amber-600 border-amber-500/30">
                  {scoringLocked ? "Locked (scoring locked)" : "Locked (judging started)"}
                </span>
              )}
            </div>

            {!isDemoDayMode && scoringLocked && scoringLockedLabel && (
              <p className="text-xs text-amber-700 dark:text-amber-300">Scores locked at {scoringLockedLabel}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Judge Code <span className="text-muted-foreground text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={judgeCodeEdit}
                  onChange={(e) => setJudgeCodeEdit(e.target.value)}
                  className="input"
                  disabled={!canEditJudgeSettings}
                  placeholder="Enter code required for judges"
                />
                <p className="text-xs text-muted-foreground">Leave empty to allow judges without a code.</p>
              </div>
              <div className="space-y-2">
                <StyledCheckbox
                  checked={enableCohorts}
                  onCheckedChange={setEnableCohorts}
                  disabled={!canEditJudgeSettings}
                  label="Enable Multiple Judging Cohorts"
                  labelClassName="text-sm font-medium text-foreground"
                />
                <p className="text-xs text-muted-foreground">Judges pick their own teams (useful for large events).</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Judging Categories &amp; Weights (0-2)</label>
                {!scoresLoaded && <span className="text-xs text-muted-foreground">Loading scores...</span>}
              </div>
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <div className="grid grid-cols-[1fr,110px,110px,40px] gap-2 px-4 py-3 border-b border-border bg-muted/20 text-xs text-muted-foreground uppercase tracking-wide">
                  <span>Category</span>
                  <span>Weight</span>
                  <span className="text-center">Opt-out allowed</span>
                  <span className="text-right" aria-hidden />
                </div>
                <div className="divide-y divide-border">
                  {categoriesEdit.map((cat, index) => (
                    <div key={index} className="grid grid-cols-[1fr,110px,110px,40px] gap-2 items-center px-4 py-3 hover:bg-muted/20 transition-colors">
                      <input
                        type="text"
                        required
                        value={cat.name}
                        onChange={(e) => {
                          const next = [...categoriesEdit];
                          next[index].name = e.target.value;
                          setCategoriesEdit(next);
                        }}
                        className="bg-transparent border-0 ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary rounded-md px-3 py-1.5 text-sm w-full placeholder:text-muted-foreground"
                        placeholder="e.g., Innovation"
                        disabled={!canEditJudgeSettings}
                      />
                      <StyledNumberInput
                        value={cat.weight}
                        onValueChange={(nextValue: number) => {
                          const next = [...categoriesEdit];
                          next[index].weight = nextValue;
                          setCategoriesEdit(next);
                        }}
                        min={0}
                        max={2}
                        step={0.1}
                        placeholder="1.0"
                        disabled={!canEditJudgeSettings}
                      />
                      <StyledCheckbox
                        checked={cat.optOutAllowed ?? false}
                        onCheckedChange={(checked: boolean) => {
                          const next = [...categoriesEdit];
                          next[index].optOutAllowed = checked;
                          setCategoriesEdit(next);
                        }}
                        disabled={!canEditJudgeSettings}
                        className="mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => setCategoriesEdit(categoriesEdit.filter((_, i) => i !== index))}
                        className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Remove ${cat.name || "category"}`}
                        disabled={!canEditJudgeSettings}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={() =>
                    setCategoriesEdit([...categoriesEdit, { name: "", weight: 1, optOutAllowed: false }])
                  }
                  className="btn-ghost text-sm"
                  disabled={!canEditJudgeSettings}
                >
                  + Add Category
                </button>
                <div aria-hidden />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveJudgeSettings}
                disabled={savingJudgeSettings || !canEditJudgeSettings || !scoresLoaded}
                className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingJudgeSettings ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Judging Settings"
                )}
              </button>
            </div>
          </div>
        )}

        {!isDemoDayMode && (
          <div className="card-static p-6 bg-card space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure prizes in the Prizes tab.
            </p>
          </div>
        )}

        {isDemoDayMode && (
          <div className="card-static p-6 bg-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.343 3-3S13.657 2 12 2 9 3.343 9 5s1.343 3 3 3zm0 2c-2.667 0-8 1.334-8 4v2a2 2 0 002 2h12a2 2 0 002-2v-2c0-2.666-5.333-4-8-4z" />
                </svg>
                Appreciation Settings (Demo Day)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Total appreciations per attendee</label>
                <StyledNumberInput
                  value={appreciationBudget}
                  onValueChange={(nextValue: number) => setAppreciationBudget(Math.max(0, Math.round(nextValue)))}
                  min={0}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Limit of hearts each attendee can give across all teams. Defaults to 100.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Max per team</label>
                <input type="text" value="3" readOnly className="input bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">
                  Per-team cap remains 3 to encourage distribution.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveAppreciationSettings}
                disabled={savingAppreciationSettings}
                className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingAppreciationSettings ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Appreciation Settings"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

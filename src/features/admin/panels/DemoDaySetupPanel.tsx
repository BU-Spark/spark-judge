import { useAction, useMutation } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatDateTime } from "../../../lib/utils";

type ImportPreview = {
  success: boolean;
  configured: boolean;
  source: "airtable" | "csv";
  error?: string;
  summary: {
    createCount: number;
    updateCount: number;
    unchangedCount: number;
    skipCount: number;
    totalRows: number;
  };
  courseCodes: string[];
  duplicateNames: string[];
  creates: PreviewItem[];
  updates: PreviewItem[];
  unchanged: PreviewItem[];
  skipped: Array<{ projectInstance: string; reason: string }>;
};

type PreviewItem = {
  action: "create" | "update" | "unchanged";
  teamId?: Id<"teams">;
  projectInstance: string;
  name: string;
  courseCode?: string;
  memberCount: number;
  changes: string[];
};

type BoardPreview = {
  success: boolean;
  summary: {
    matchedCount: number;
    unmatchedCount: number;
    invalidCount: number;
    duplicateCount: number;
  };
  matched: Array<{
    teamId: Id<"teams">;
    teamName: string;
    matchKey: string;
    projectInstance?: string;
    projectName?: string;
    signName?: string;
    fullSignName?: string;
    courseCode?: string;
    courseName?: string;
    time?: string;
    round: number;
    boardNumber: string;
    previousRound?: number;
    previousBoardNumber?: string;
  }>;
  unmatched: BoardUnmatchedRow[];
  invalidRows: Array<{
    rowNumber: number;
    projectInstance?: string;
    reason: string;
  }>;
  duplicateProjectInstances: string[];
};

type BoardUnmatchedRow = {
  matchKey: string;
  projectInstance?: string;
  projectName?: string;
  signName?: string;
  fullSignName?: string;
  courseCode?: string;
  courseName?: string;
  time?: string;
  round: number;
  boardNumber: string;
  reason: string;
};

type TeamOption = {
  _id: Id<"teams">;
  name: string;
  courseCode?: string;
  demoDayProjectInstance?: string;
  demoDayRound?: number;
  demoDayBoardNumber?: string;
};

function readFileText(file: File | undefined) {
  if (!file) return Promise.resolve("");
  return file.text();
}

function normalizeMatchText(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function getBoardRowTitle(row: BoardUnmatchedRow) {
  return (
    row.projectName ||
    row.signName ||
    row.fullSignName ||
    row.projectInstance ||
    row.matchKey
  );
}

function getBoardRowMeta(row: BoardUnmatchedRow) {
  return [
    row.courseCode,
    row.courseName,
    `Round ${row.round}`,
    `Board ${row.boardNumber}`,
    row.time,
  ]
    .filter(Boolean)
    .join(" · ");
}

function scoreTeamForBoardRow(row: BoardUnmatchedRow, team: TeamOption) {
  let score = 0;
  const rowNames = [
    row.projectInstance,
    row.projectName,
    row.signName,
    row.fullSignName,
  ]
    .map(normalizeMatchText)
    .filter(Boolean);
  const teamNames = [team.demoDayProjectInstance, team.name]
    .map(normalizeMatchText)
    .filter(Boolean);

  if (row.courseCode && team.courseCode === row.courseCode) score += 8;
  for (const rowName of rowNames) {
    for (const teamName of teamNames) {
      if (rowName === teamName) score += 20;
      else if (rowName.includes(teamName) || teamName.includes(rowName)) {
        score += 10;
      }
    }
  }
  return score;
}

function CountPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "good" | "warn" | "pink";
}) {
  const className =
    tone === "good"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "pink"
          ? "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300"
          : "border-border bg-muted/30 text-foreground";

  return (
    <div className={`rounded-lg border px-3 py-2 ${className}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}

function PreviewList({
  title,
  items,
}: {
  title: string;
  items: PreviewItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border">
        {items.slice(0, 5).map((item) => (
          <div
            key={`${item.action}-${item.projectInstance}`}
            className="px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{item.name}</span>
              {item.courseCode && (
                <span className="rounded bg-pink-500/10 px-2 py-0.5 text-xs text-pink-600 dark:text-pink-300">
                  {item.courseCode}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {item.memberCount} member{item.memberCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.projectInstance}
              {item.changes.length > 0 ? ` · ${item.changes.join(", ")}` : ""}
            </p>
          </div>
        ))}
        {items.length > 5 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {items.length - 5} more not shown
          </div>
        )}
      </div>
    </div>
  );
}

function TeamMatchPicker({
  row,
  teams,
  selectedTeamId,
  query,
  onQueryChange,
  onSelect,
}: {
  row: BoardUnmatchedRow;
  teams: TeamOption[];
  selectedTeamId?: Id<"teams">;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (teamId: Id<"teams"> | "") => void;
}) {
  const selectedTeam = teams.find((team) => team._id === selectedTeamId);
  const candidates = useMemo(() => {
    const search = normalizeMatchText(query);
    return teams
      .map((team) => ({
        team,
        score: scoreTeamForBoardRow(row, team),
        searchText: normalizeMatchText(
          [
            team.name,
            team.courseCode,
            team.demoDayProjectInstance,
            team.demoDayBoardNumber,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      }))
      .filter(
        (item) =>
          !search ||
          item.searchText.includes(search) ||
          normalizeMatchText(getBoardRowTitle(row)).includes(search),
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.team.name.localeCompare(b.team.name);
      })
      .slice(0, 6);
  }, [query, row, teams]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Match to app team
        </label>
        {selectedTeam && (
          <button
            type="button"
            onClick={() => onSelect("")}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="input h-9 w-full text-sm"
        placeholder="Search imported teams..."
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
        {candidates.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            No imported teams match that search.
          </div>
        ) : (
          candidates.map(({ team, score }) => {
            const selected = team._id === selectedTeamId;
            return (
              <button
                key={team._id}
                type="button"
                onClick={() => onSelect(team._id)}
                className={`flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-pink-500/40 ${
                  selected ? "bg-pink-500/10" : "bg-background"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {team.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {[
                      team.courseCode,
                      team.demoDayProjectInstance,
                      team.demoDayRound && team.demoDayBoardNumber
                        ? `currently ${team.demoDayRound}/${team.demoDayBoardNumber}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    selected
                      ? "bg-pink-500/15 text-pink-700 dark:text-pink-300"
                      : score > 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selected ? "selected" : score > 0 ? "suggested" : "manual"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DemoDaySetupPanel({
  eventId,
  event,
  onDownloadQrCodes,
  isGeneratingQr,
}: {
  eventId: Id<"events">;
  event: any;
  onDownloadQrCodes: () => void;
  isGeneratingQr: boolean;
}) {
  const listSemesters = useAction(api.demoDayImport.listDemoDayImportSemesters);
  const previewImport = useAction(api.demoDayImport.previewDemoDayImport);
  const applyImport = useAction(api.demoDayImport.applyDemoDayImport);
  const previewBoardCsv = useAction(
    api.demoDayImport.previewBoardAssignmentCsv,
  );
  const applyBoardCsv = useAction(api.demoDayImport.applyBoardAssignmentCsv);
  const updateEventCourseCodes = useMutation(api.events.updateEventCourseCodes);

  const assignmentsInputRef = useRef<HTMLInputElement | null>(null);
  const projectInstancesInputRef = useRef<HTMLInputElement | null>(null);
  const projectsInputRef = useRef<HTMLInputElement | null>(null);
  const boardInputRef = useRef<HTMLInputElement | null>(null);

  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [semesterStatus, setSemesterStatus] = useState<{
    configured: boolean;
    semesters: string[];
    error?: string;
  } | null>(null);
  const [semester, setSemester] = useState("");
  const [assignmentsCsv, setAssignmentsCsv] = useState("");
  const [projectInstancesCsv, setProjectInstancesCsv] = useState("");
  const [projectsCsv, setProjectsCsv] = useState("");
  const [assignmentsFileName, setAssignmentsFileName] = useState("");
  const [projectInstancesFileName, setProjectInstancesFileName] = useState("");
  const [projectsFileName, setProjectsFileName] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importBusy, setImportBusy] = useState(false);
  const [courseInput, setCourseInput] = useState("");
  const [courseBusy, setCourseBusy] = useState(false);

  const [boardCsv, setBoardCsv] = useState("");
  const [boardFileName, setBoardFileName] = useState("");
  const [boardPreview, setBoardPreview] = useState<BoardPreview | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  const [manualBoardMatches, setManualBoardMatches] = useState<
    Record<string, Id<"teams"> | "">
  >({});
  const [createBoardTeams, setCreateBoardTeams] = useState<
    Record<string, boolean>
  >({});
  const [boardMatchSearch, setBoardMatchSearch] = useState<
    Record<string, string>
  >({});

  const visibleTeams = useMemo(
    () => (event.teams || []).filter((team: any) => !team.hidden),
    [event.teams],
  );
  const teamOptions = useMemo(
    () =>
      visibleTeams
        .map((team: any) => ({
          _id: team._id as Id<"teams">,
          name: team.name as string,
          courseCode: team.courseCode as string | undefined,
          demoDayProjectInstance: team.demoDayProjectInstance as
            | string
            | undefined,
          demoDayRound: team.demoDayRound as number | undefined,
          demoDayBoardNumber: team.demoDayBoardNumber as string | undefined,
        }))
        .sort((a: TeamOption, b: TeamOption) => {
          const courseCompare = (a.courseCode || "").localeCompare(
            b.courseCode || "",
          );
          return courseCompare || a.name.localeCompare(b.name);
        }),
    [visibleTeams],
  );
  const missingCourseCount = visibleTeams.filter(
    (team: any) => !team.courseCode,
  ).length;
  const missingBoardCount = visibleTeams.filter(
    (team: any) => !team.demoDayRound || !team.demoDayBoardNumber,
  ).length;
  const sourceKeyedCount = visibleTeams.filter(
    (team: any) => !!team.demoDayProjectInstance,
  ).length;
  const configuredCourseCodes = useMemo(
    () =>
      ((event.courseCodes || []) as string[])
        .map(normalizeCourseCode)
        .filter(Boolean),
    [event.courseCodes],
  );
  const detectedCourseCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const team of visibleTeams) {
      const code = normalizeCourseCode(team.courseCode || "");
      if (code) codes.add(code);
    }
    for (const code of importPreview?.courseCodes || []) {
      const normalized = normalizeCourseCode(code);
      if (normalized) codes.add(normalized);
    }
    for (const row of boardPreview?.matched || []) {
      const code = normalizeCourseCode(row.courseCode || "");
      if (code) codes.add(code);
    }
    for (const row of boardPreview?.unmatched || []) {
      const code = normalizeCourseCode(row.courseCode || "");
      if (code) codes.add(code);
    }
    return Array.from(codes).sort();
  }, [boardPreview, importPreview, visibleTeams]);
  const missingDetectedCourseCodes = detectedCourseCodes.filter(
    (code) => !configuredCourseCodes.includes(code),
  );
  const teamCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const team of visibleTeams) {
      const code = normalizeCourseCode(team.courseCode || "");
      if (!code) continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [visibleTeams]);
  const hasCsvPair = !!assignmentsCsv && !!projectsCsv;
  const canPreviewImport =
    !!semester.trim() && (!!semesterStatus?.configured || hasCsvPair);
  const manualMatchesPayload = () =>
    Object.entries(manualBoardMatches)
      .filter((entry): entry is [string, Id<"teams">] => !!entry[1])
      .map(([matchKey, teamId]) => ({ matchKey, teamId }));
  const createTeamsPayload = () =>
    Object.entries(createBoardTeams)
      .filter(([, shouldCreate]) => shouldCreate)
      .map(([matchKey]) => ({ matchKey }));
  const unresolvedBoardRows = boardPreview
    ? boardPreview.unmatched
        .filter((row) => !manualBoardMatches[row.matchKey])
        .filter((row) => !createBoardTeams[row.matchKey])
    : [];
  const resolvedManualCount = boardPreview
    ? boardPreview.unmatched.length - unresolvedBoardRows.length
    : 0;
  const canApplyBoards =
    !!boardPreview &&
    !!boardCsv &&
    boardPreview.summary.invalidCount === 0 &&
    boardPreview.summary.duplicateCount === 0 &&
    unresolvedBoardRows.length === 0;

  const loadSemesters = async () => {
    setLoadingSemesters(true);
    try {
      const result = await listSemesters({});
      setSemesterStatus(result);
      if (!semester && result.semesters.length > 0) {
        setSemester(result.semesters[result.semesters.length - 1]);
      }
    } catch (error: any) {
      setSemesterStatus({
        configured: false,
        semesters: [],
        error: error?.message || "Failed to load Airtable semesters.",
      });
    } finally {
      setLoadingSemesters(false);
    }
  };

  useEffect(() => {
    void loadSemesters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importArgs = () => ({
    eventId,
    semester: semester.trim(),
    ...(hasCsvPair
      ? {
          assignmentsCsv,
          ...(projectInstancesCsv ? { projectInstancesCsv } : {}),
          projectsCsv,
        }
      : {}),
  });

  const saveCourseCodes = async (
    courseCodes: string[],
    successMessage: string,
  ) => {
    const normalized = Array.from(
      new Set(courseCodes.map(normalizeCourseCode).filter(Boolean)),
    );
    setCourseBusy(true);
    try {
      await updateEventCourseCodes({ eventId, courseCodes: normalized });
      toast.success(successMessage);
      setCourseInput("");
    } catch (error: any) {
      toast.error(error?.message || "Could not update course codes.");
    } finally {
      setCourseBusy(false);
    }
  };

  const handleAddCourseCode = async () => {
    const code = normalizeCourseCode(courseInput);
    if (!code) {
      toast.error("Enter a course code.");
      return;
    }
    if (configuredCourseCodes.includes(code)) {
      toast.error(`${code} is already configured.`);
      return;
    }
    await saveCourseCodes(
      [...configuredCourseCodes, code],
      `Added ${code} to this event.`,
    );
  };

  const handleRemoveCourseCode = async (code: string) => {
    await saveCourseCodes(
      configuredCourseCodes.filter((existing) => existing !== code),
      `Removed ${code} from this event.`,
    );
  };

  const handleSyncDetectedCourses = async () => {
    if (missingDetectedCourseCodes.length === 0) {
      toast.info("All detected courses are already configured.");
      return;
    }
    await saveCourseCodes(
      [...configuredCourseCodes, ...missingDetectedCourseCodes],
      `Added ${missingDetectedCourseCodes.length} detected course${
        missingDetectedCourseCodes.length === 1 ? "" : "s"
      }.`,
    );
  };

  const handlePreviewImport = async () => {
    if (!canPreviewImport) {
      toast.error(
        "Choose a semester and connect Airtable or upload both CSVs.",
      );
      return;
    }

    setImportBusy(true);
    try {
      const result = (await previewImport(importArgs())) as ImportPreview;
      setImportPreview(result);
      if (!result.success) {
        toast.error(result.error || "Import preview failed.");
      } else {
        toast.success("Import preview ready.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Import preview failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importPreview?.success) return;

    setImportBusy(true);
    try {
      const result = (await applyImport(importArgs())) as ImportPreview;
      setImportPreview(result);
      if (!result.success) {
        toast.error(result.error || "Import failed.");
      } else {
        toast.success(
          `Imported ${result.summary.createCount} new and updated ${result.summary.updateCount}.`,
        );
      }
    } catch (error: any) {
      toast.error(error?.message || "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const handlePreviewBoardCsv = async () => {
    if (!boardCsv) {
      toast.error("Upload a board assignment CSV first.");
      return;
    }

    setBoardBusy(true);
    try {
      const result = (await previewBoardCsv({
        eventId,
        csv: boardCsv,
        manualMatches: manualMatchesPayload(),
      })) as BoardPreview;
      setBoardPreview(result);
      if (result.success) {
        toast.success("Board preview ready.");
      } else {
        toast.error("Board CSV needs attention before applying.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Board preview failed.");
    } finally {
      setBoardBusy(false);
    }
  };

  const handleApplyBoardCsv = async () => {
    if (!canApplyBoards || !boardCsv) return;

    setBoardBusy(true);
    try {
      const result = (await applyBoardCsv({
        eventId,
        csv: boardCsv,
        manualMatches: manualMatchesPayload(),
        createTeams: createTeamsPayload(),
      })) as BoardPreview;
      setBoardPreview(result);
      if (result.success) {
        toast.success(
          `Updated ${result.summary.matchedCount} board assignments.`,
        );
      } else {
        toast.error("Board assignments were not applied.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Board assignment import failed.");
    } finally {
      setBoardBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-500">
              Demo Day Setup
            </p>
            <h3 className="mt-1 text-xl font-heading font-bold text-foreground">
              Import teams, assign boards, print QR codes
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              This workflow is built for repeat semester setup. Airtable is the
              primary source when configured; CSV uploads use the same preview
              and apply path.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
            <CountPill
              label="Projects"
              value={visibleTeams.length}
              tone="pink"
            />
            <CountPill
              label="Source Keys"
              value={sourceKeyedCount}
              tone="good"
            />
            <CountPill
              label="Missing Course"
              value={missingCourseCount}
              tone={missingCourseCount > 0 ? "warn" : "good"}
            />
            <CountPill
              label="Missing Board"
              value={missingBoardCount}
              tone={missingBoardCount > 0 ? "warn" : "good"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-heading font-semibold text-foreground">
              Course Roster
            </h4>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              These course codes drive admin team forms and Demo Day filtering.
              Imports and board previews can detect courses, but admins can add
              a missing course directly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncDetectedCourses}
            disabled={courseBusy || missingDetectedCourseCodes.length === 0}
            className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sync Detected
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_minmax(18rem,24rem)]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {configuredCourseCodes.length > 0 ? (
                configuredCourseCodes.map((code) => (
                  <div
                    key={code}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{code}</span>
                    <span className="text-xs text-muted-foreground">
                      {teamCountByCourse.get(code) || 0} project
                      {(teamCountByCourse.get(code) || 0) === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveCourseCode(code)}
                      disabled={courseBusy}
                      className="ml-1 rounded px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Remove ${code}`}
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  No course codes configured yet.
                </div>
              )}
            </div>

            {missingDetectedCourseCodes.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Detected but not configured
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingDetectedCourseCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() =>
                        void saveCourseCodes(
                          [...configuredCourseCodes, code],
                          `Added ${code} to this event.`,
                        )
                      }
                      disabled={courseBusy}
                      className="rounded-md border border-amber-500/25 bg-background px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200"
                    >
                      Add {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add Course
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={courseInput}
                onChange={(event) => setCourseInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddCourseCode();
                  }
                }}
                className="input h-9 min-w-0 flex-1 text-sm"
                placeholder="XC475"
              />
              <button
                type="button"
                onClick={() => void handleAddCourseCode()}
                disabled={courseBusy}
                className="btn-primary h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Codes are saved uppercase and can include slashes, like DS488/688.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-heading font-semibold text-foreground">
              1. Team Import
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Select the Airtable semester, or upload Assignments.csv and
              Projects.csv if Airtable env vars are unavailable. Project
              Instances.csv can be added to preserve instance-level metadata.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSemesters()}
            disabled={loadingSemesters}
            className="btn-secondary text-sm"
          >
            {loadingSemesters ? "Refreshing..." : "Refresh Semesters"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(16rem,24rem)_1fr]">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Semester
              </label>
              {semesterStatus?.semesters.length ? (
                <select
                  value={semester}
                  onChange={(e) => {
                    setSemester(e.target.value);
                    setImportPreview(null);
                  }}
                  className="input w-full"
                >
                  {semesterStatus.semesters.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={semester}
                  onChange={(e) => {
                    setSemester(e.target.value);
                    setImportPreview(null);
                  }}
                  className="input w-full"
                  placeholder="Fall 2026"
                />
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">
                {semesterStatus?.configured
                  ? "Airtable API configured"
                  : "CSV fallback"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {semesterStatus?.error ||
                  "Airtable data will be fetched server-side from Convex."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  Assignments.csv
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {assignmentsFileName || "No file selected"}
                </p>
                <input
                  ref={assignmentsInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    setAssignmentsFileName(file?.name || "");
                    setAssignmentsCsv(await readFileText(file));
                    setImportPreview(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => assignmentsInputRef.current?.click()}
                  className="btn-secondary mt-3 text-sm"
                >
                  Choose File
                </button>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  Project Instances.csv
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {projectInstancesFileName || "Optional, but recommended"}
                </p>
                <input
                  ref={projectInstancesInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    setProjectInstancesFileName(file?.name || "");
                    setProjectInstancesCsv(await readFileText(file));
                    setImportPreview(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => projectInstancesInputRef.current?.click()}
                  className="btn-secondary mt-3 text-sm"
                >
                  Choose File
                </button>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  Projects.csv
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {projectsFileName || "No file selected"}
                </p>
                <input
                  ref={projectsInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    setProjectsFileName(file?.name || "");
                    setProjectsCsv(await readFileText(file));
                    setImportPreview(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => projectsInputRef.current?.click()}
                  className="btn-secondary mt-3 text-sm"
                >
                  Choose File
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handlePreviewImport}
                disabled={importBusy || !canPreviewImport}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importBusy ? "Working..." : "Preview Import"}
              </button>
              <button
                type="button"
                onClick={handleApplyImport}
                disabled={importBusy || !importPreview?.success}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply Import
              </button>
            </div>
          </div>
        </div>

        {importPreview && (
          <div className="mt-4 space-y-3">
            <div
              className={`rounded-lg border p-3 ${
                importPreview.success
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-red-500/25 bg-red-500/5"
              }`}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <CountPill
                  label="Create"
                  value={importPreview.summary.createCount}
                  tone="good"
                />
                <CountPill
                  label="Update"
                  value={importPreview.summary.updateCount}
                  tone="pink"
                />
                <CountPill
                  label="Unchanged"
                  value={importPreview.summary.unchangedCount}
                />
                <CountPill
                  label="Skipped"
                  value={importPreview.summary.skipCount}
                  tone={importPreview.summary.skipCount > 0 ? "warn" : "good"}
                />
                <CountPill label="Source" value={importPreview.source} />
              </div>
              {importPreview.error && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-300">
                  {importPreview.error}
                </p>
              )}
              {importPreview.duplicateNames.length > 0 && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  Duplicate project names:{" "}
                  {importPreview.duplicateNames.join(", ")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <PreviewList title="Creates" items={importPreview.creates} />
              <PreviewList title="Updates" items={importPreview.updates} />
            </div>
            {importPreview.skipped.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="text-sm font-medium text-foreground">
                  Skipped rows
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {importPreview.skipped.slice(0, 6).map((row, index) => (
                    <p key={`${row.projectInstance}-${index}`}>
                      {row.projectInstance || "Missing project"}: {row.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-heading font-semibold text-foreground">
              2. Board Assignments
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the board assignment export as-is. Rows match by project
              instance when present, otherwise by project/team or sign name plus
              course.
            </p>
          </div>
          <input
            ref={boardInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setBoardFileName(file?.name || "");
              setBoardCsv(await readFileText(file));
              setBoardPreview(null);
              setManualBoardMatches({});
              setCreateBoardTeams({});
              setBoardMatchSearch({});
            }}
          />
          <button
            type="button"
            onClick={() => boardInputRef.current?.click()}
            className="btn-secondary text-sm"
          >
            Choose Board CSV
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="truncate text-sm text-muted-foreground">
            {boardFileName || "No board assignment file selected"}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handlePreviewBoardCsv}
              disabled={boardBusy || !boardCsv}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {boardBusy ? "Working..." : "Preview Boards"}
            </button>
            <button
              type="button"
              onClick={handleApplyBoardCsv}
              disabled={boardBusy || !canApplyBoards}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Boards
            </button>
          </div>
        </div>

        {boardPreview && (
          <div className="mt-4 space-y-3">
            <div
              className={`rounded-lg border p-3 ${
                canApplyBoards
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-amber-500/25 bg-amber-500/5"
              }`}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <CountPill
                  label="Matched"
                  value={boardPreview.summary.matchedCount}
                  tone="good"
                />
                <CountPill
                  label="To Reconcile"
                  value={boardPreview.summary.unmatchedCount}
                  tone={
                    boardPreview.summary.unmatchedCount > 0 ? "warn" : "good"
                  }
                />
                <CountPill
                  label="Resolved"
                  value={resolvedManualCount}
                  tone={resolvedManualCount > 0 ? "pink" : "neutral"}
                />
                <CountPill
                  label="Invalid"
                  value={boardPreview.summary.invalidCount}
                  tone={boardPreview.summary.invalidCount > 0 ? "warn" : "good"}
                />
                <CountPill
                  label="Duplicates"
                  value={boardPreview.summary.duplicateCount}
                  tone={
                    boardPreview.summary.duplicateCount > 0 ? "warn" : "good"
                  }
                />
              </div>
              {boardPreview.unmatched.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  If a course has Project Instance rows but no Assignment rows,
                  rerun Team Import first. Project Instances can now create
                  zero-member teams, then the remaining name mismatches can be
                  matched manually below. If a course is not in Airtable at all,
                  create the team directly from the board row.
                </p>
              )}
            </div>
            {boardPreview.matched.length > 0 && (
              <div className="rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Matched assignments
                  </div>
                  {boardPreview.matched.length > 6 && (
                    <div className="text-xs text-muted-foreground">
                      showing 6 of {boardPreview.matched.length}
                    </div>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {boardPreview.matched.slice(0, 6).map((row) => (
                    <div key={row.matchKey} className="px-3 py-2">
                      <p className="text-sm font-medium text-foreground">
                        {row.signName || row.teamName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.projectInstance || row.projectName || row.matchKey}{" "}
                        · Round {row.round} · Board {row.boardNumber}
                        {row.time ? ` · ${row.time}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {boardPreview.unmatched.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5">
                <div className="flex flex-col gap-1 border-b border-amber-500/20 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Reconciliation workbench
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Match each board-row slip to an imported app team, or
                      create a zero-member team directly from the board row.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {unresolvedBoardRows.length} remaining
                  </p>
                </div>
                <div className="divide-y divide-amber-500/15">
                  {boardPreview.unmatched.map((row) => {
                    const selectedTeamId = manualBoardMatches[row.matchKey];
                    const shouldCreateTeam = !!createBoardTeams[row.matchKey];
                    return (
                      <div
                        key={row.matchKey}
                        className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.2fr)]"
                      >
                        <div className="min-w-0 rounded-lg border border-amber-500/20 bg-background/80 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                              Board {row.boardNumber}
                            </span>
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Round {row.round}
                            </span>
                            {row.courseCode && (
                              <span className="rounded bg-pink-500/10 px-2 py-0.5 text-xs text-pink-700 dark:text-pink-300">
                                {row.courseCode}
                              </span>
                            )}
                          </div>
                          <p className="mt-3 break-words text-sm font-semibold text-foreground">
                            {getBoardRowTitle(row)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {getBoardRowMeta(row)}
                          </p>
                          {row.fullSignName && (
                            <p className="mt-2 break-words text-xs text-muted-foreground">
                              Sign: {row.fullSignName}
                            </p>
                          )}
                          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                            {row.reason}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <TeamMatchPicker
                            row={row}
                            teams={teamOptions}
                            selectedTeamId={
                              shouldCreateTeam
                                ? undefined
                                : selectedTeamId || undefined
                            }
                            query={boardMatchSearch[row.matchKey] || ""}
                            onQueryChange={(value) =>
                              setBoardMatchSearch((current) => ({
                                ...current,
                                [row.matchKey]: value,
                              }))
                            }
                            onSelect={(teamId) => {
                              setManualBoardMatches((current) => ({
                                ...current,
                                [row.matchKey]: teamId,
                              }));
                              if (teamId) {
                                setCreateBoardTeams((current) => ({
                                  ...current,
                                  [row.matchKey]: false,
                                }));
                              }
                            }}
                          />

                          <div
                            className={`rounded-lg border p-3 ${
                              shouldCreateTeam
                                ? "border-emerald-500/30 bg-emerald-500/10"
                                : "border-border bg-background"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  Create a new team from this board row
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {getBoardRowTitle(row)}
                                  {row.courseCode ? ` · ${row.courseCode}` : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateBoardTeams((current) => ({
                                    ...current,
                                    [row.matchKey]: !shouldCreateTeam,
                                  }));
                                  if (!shouldCreateTeam) {
                                    setManualBoardMatches((current) => ({
                                      ...current,
                                      [row.matchKey]: "",
                                    }));
                                  }
                                }}
                                className={
                                  shouldCreateTeam
                                    ? "btn-secondary text-sm"
                                    : "btn-primary text-sm"
                                }
                              >
                                {shouldCreateTeam ? "Do Not Create" : "Create"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(boardPreview.invalidRows.length > 0 ||
              boardPreview.duplicateProjectInstances.length > 0) && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-3 text-sm">
                <p className="font-medium text-foreground">
                  Blocking CSV issues
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {boardPreview.invalidRows.slice(0, 5).map((row) => (
                    <p key={`invalid-${row.rowNumber}`}>
                      Row {row.rowNumber}: {row.reason}
                    </p>
                  ))}
                  {boardPreview.duplicateProjectInstances.length > 0 && (
                    <p>
                      Duplicate project instances:{" "}
                      {boardPreview.duplicateProjectInstances.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="text-lg font-heading font-semibold text-foreground">
              3. QR Code Package
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Generates labeled SVG files, print-by-course, print-by-board, and
              the projects manifest CSV.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Event window: {formatDateTime(event.startDate)} to{" "}
              {formatDateTime(event.endDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadQrCodes}
            disabled={isGeneratingQr || visibleTeams.length === 0}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGeneratingQr ? "Generating..." : "Download QR ZIP"}
          </button>
        </div>
      </section>
    </div>
  );
}

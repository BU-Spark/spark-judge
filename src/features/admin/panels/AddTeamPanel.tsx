import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  createTeamCsvTemplate,
  parseTeamCsv,
  type ParsedTeamCsvRow,
} from "./teamCsv";

type PreparedTeamCsvRow = ParsedTeamCsvRow & {
  prizeIds: Id<"prizes">[];
};

type CsvImportNotice = {
  tone: "neutral" | "success" | "error";
  summary: string;
  details: string[];
};

const MAX_VISIBLE_IMPORT_DETAILS = 5;

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

export function AddTeamPanel({
  eventId,
  onClose,
  onSubmit,
  onSubmitEdit,
  eventMode,
  tracks,
  eventPrizes,
  prizesLoading,
  teamPrizeIdsByTeamId,
  courseCodes,
  editingTeam,
}: {
  eventId: Id<"events">;
  onClose: () => void;
  onSubmit: any;
  onSubmitEdit?: any;
  eventMode?: "hackathon" | "demo_day" | "code_and_tell";
  tracks?: string[];
  eventPrizes?: any[];
  prizesLoading?: boolean;
  teamPrizeIdsByTeamId?: Map<string, string[]>;
  courseCodes?: string[];
  editingTeam?: any;
}) {
  const isDemoDay = eventMode === "demo_day";
  const isCodeAndTell = eventMode === "code_and_tell";
  const isHackathon = !isDemoDay && !isCodeAndTell;
  const entityLabel = isCodeAndTell ? "Project" : "Team";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: "",
    entrantEmails: "",
    track: "",
    projectUrl: "",
    courseCode: "",
  });
  const [selectedPrizeIds, setSelectedPrizeIds] = useState<string[]>([]);
  const [sponsorFilter, setSponsorFilter] = useState("");
  const [csvImportPlan, setCsvImportPlan] = useState<{
    fileName: string;
    rows: PreparedTeamCsvRow[];
  } | null>(null);
  const [csvImportNotice, setCsvImportNotice] =
    useState<CsvImportNotice | null>(null);
  const setTeamPrizeSubmissionsAdmin = useMutation(
    api.prizes.setTeamPrizeSubmissionsAdmin,
  );

  const eligiblePrizes = useMemo(() => {
    if (!isHackathon) return [];
    const prizes = eventPrizes || [];
    return prizes.filter((prize: any) => {
      if (prize.isActive === false) return false;
      if (prize.type === "track" || prize.type === "track_sponsor") {
        return !!formData.track && prize.track === formData.track;
      }
      return true;
    });
  }, [isHackathon, eventPrizes, formData.track]);

  const sponsorOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(
          eligiblePrizes
            .map((prize: any) => (prize.sponsorName || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [eligiblePrizes],
  );

  const filteredPrizes = useMemo(() => {
    if (!sponsorFilter) return eligiblePrizes;
    return eligiblePrizes.filter(
      (prize: any) => (prize.sponsorName || "").trim() === sponsorFilter,
    );
  }, [eligiblePrizes, sponsorFilter]);

  const prizeLookup = useMemo(() => {
    const lookup = new Map<string, any[]>();
    for (const prize of eventPrizes || []) {
      const key = normalizeLookupKey(prize.name || "");
      if (!key) continue;
      const matches = lookup.get(key) || [];
      matches.push(prize);
      lookup.set(key, matches);
    }
    return lookup;
  }, [eventPrizes]);

  useEffect(() => {
    if (editingTeam) {
      setFormData({
        name: editingTeam.name || "",
        description: editingTeam.description || "",
        members: editingTeam.members?.join(", ") || "",
        entrantEmails: (editingTeam.entrantEmails || []).join(", "),
        track: editingTeam.track || "",
        projectUrl: editingTeam.projectUrl || editingTeam.githubUrl || "",
        courseCode: editingTeam.courseCode || "",
      });
      setSelectedPrizeIds(
        teamPrizeIdsByTeamId?.get(String(editingTeam._id)) || [],
      );
      setSponsorFilter("");
    } else {
      setFormData({
        name: "",
        description: "",
        members: "",
        entrantEmails: "",
        track: "",
        projectUrl: "",
        courseCode: "",
      });
      setSelectedPrizeIds([]);
      setSponsorFilter("");
    }
  }, [editingTeam, teamPrizeIdsByTeamId]);

  useEffect(() => {
    setCsvImportPlan(null);
    setCsvImportNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [editingTeam, eventId]);

  useEffect(() => {
    if (!editingTeam) return;
    setSelectedPrizeIds(
      teamPrizeIdsByTeamId?.get(String(editingTeam._id)) || [],
    );
  }, [editingTeam, teamPrizeIdsByTeamId]);

  useEffect(() => {
    if (!isHackathon) return;
    const allowedIds = new Set(
      eligiblePrizes.map((prize: any) => String(prize._id)),
    );
    setSelectedPrizeIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [isHackathon, eligiblePrizes]);

  const resetCsvImport = () => {
    setCsvImportPlan(null);
    setCsvImportNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resolvePrizeIdsForImport = (row: ParsedTeamCsvRow) => {
    if (!isHackathon || row.prizeNames.length === 0) {
      return [] as Id<"prizes">[];
    }

    const prizeIds: Id<"prizes">[] = [];
    const seen = new Set<string>();

    for (const prizeName of row.prizeNames) {
      const key = normalizeLookupKey(prizeName);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const matches = prizeLookup.get(key) || [];
      if (matches.length === 0) {
        throw new Error(
          `Row ${row.rowNumber}: prize "${prizeName}" does not exist for this event.`,
        );
      }
      if (matches.length > 1) {
        throw new Error(
          `Row ${row.rowNumber}: prize "${prizeName}" matches multiple event prizes. Rename the prize before importing.`,
        );
      }

      const prize = matches[0];
      if (prize.isActive === false) {
        throw new Error(
          `Row ${row.rowNumber}: prize "${prize.name}" is inactive.`,
        );
      }
      if (
        (prize.type === "track" || prize.type === "track_sponsor") &&
        prize.track &&
        prize.track !== row.track
      ) {
        throw new Error(
          `Row ${row.rowNumber}: prize "${prize.name}" only accepts teams in the "${prize.track}" track.`,
        );
      }

      prizeIds.push(prize._id as Id<"prizes">);
    }

    return prizeIds;
  };

  const handleDownloadTemplate = () => {
    const csvContent = createTeamCsvTemplate(
      isDemoDay ? "demo_day" : isCodeAndTell ? "code_and_tell" : "hackathon",
      isHackathon && (eventPrizes?.length || 0) > 0,
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = isDemoDay
      ? "demo-day-team-template.csv"
      : isCodeAndTell
        ? "code-and-tell-project-template.csv"
        : "hackathon-team-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedRows = parseTeamCsv(
        await file.text(),
        isDemoDay ? "demo_day" : isCodeAndTell ? "code_and_tell" : "hackathon",
      );
      const preparedRows = parsedRows.map((row) => ({
        ...row,
        prizeIds: resolvePrizeIdsForImport(row),
      }));

      setCsvImportPlan({
        fileName: file.name,
        rows: preparedRows,
      });
      setCsvImportNotice({
        tone: "neutral",
        summary: `${preparedRows.length} ${entityLabel.toLowerCase()}${preparedRows.length === 1 ? "" : "s"} ready to import from ${file.name}.`,
        details: [],
      });
    } catch (error: any) {
      const details = String(error?.message || "Failed to read CSV")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      setCsvImportPlan(null);
      setCsvImportNotice({
        tone: "error",
        summary: "CSV file has errors. Fix the rows below and try again.",
        details,
      });
      toast.error("CSV file has errors.");
    }
  };

  const handleImportCsv = async () => {
    if (!csvImportPlan) return;

    setImportingCsv(true);
    const failures: string[] = [];
    const failedRows: PreparedTeamCsvRow[] = [];
    let importedCount = 0;

    try {
      for (const row of csvImportPlan.rows) {
        try {
          const teamId = await onSubmit({
            eventId,
            name: row.name,
            description: row.description,
            members: row.members,
            entrantEmails: row.entrantEmails,
            ...(isDemoDay
              ? { courseCode: row.courseCode || undefined }
              : isHackathon
                ? {
                  track: row.track || undefined,
                  projectUrl: row.projectUrl || undefined,
                }
                : {
                    projectUrl: row.projectUrl || undefined,
                  }),
          });

          if (isHackathon && row.prizeIds.length > 0) {
            await setTeamPrizeSubmissionsAdmin({
              eventId,
              teamId,
              prizeIds: row.prizeIds,
            });
          }

          importedCount += 1;
        } catch (error: any) {
          failures.push(
            `Row ${row.rowNumber} (${row.name}): ${error?.message || "Failed to import team"}`,
          );
          failedRows.push(row);
        }
      }

      setCsvImportPlan(
        failures.length === 0
          ? null
          : {
              fileName: csvImportPlan.fileName,
              rows: failedRows,
            },
      );
      if (failures.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setCsvImportNotice({
        tone: failures.length === 0 ? "success" : "error",
        summary:
          failures.length === 0
            ? `Imported ${importedCount} ${entityLabel.toLowerCase()}${importedCount === 1 ? "" : "s"} from ${csvImportPlan.fileName}.`
            : `Imported ${importedCount} of ${csvImportPlan.rows.length} ${entityLabel.toLowerCase()}${csvImportPlan.rows.length === 1 ? "" : "s"} from ${csvImportPlan.fileName}.`,
        details: failures,
      });

      if (failures.length === 0) {
        toast.success(
          `Imported ${importedCount} ${entityLabel.toLowerCase()}${importedCount === 1 ? "" : "s"}.`,
        );
      } else {
        toast.error(
          `Imported ${importedCount} ${entityLabel.toLowerCase()}${importedCount === 1 ? "" : "s"}. ${failures.length} row${failures.length === 1 ? "" : "s"} failed.`,
        );
      }
    } finally {
      setImportingCsv(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const name = formData.name.trim();
      const members = formData.members
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const entrantEmails = formData.entrantEmails
        .split(/[;,]/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      if (!name) {
        toast.error(`${entityLabel} name is required.`);
        setSubmitting(false);
        return;
      }

      if (!isCodeAndTell && members.length === 0) {
        toast.error("At least one member is required.");
        setSubmitting(false);
        return;
      }

      if (isCodeAndTell && entrantEmails.length === 0) {
        toast.error("At least one entrant email is required.");
        setSubmitting(false);
        return;
      }

      if (isDemoDay && !formData.courseCode) {
        toast.error("Please select a course.");
        setSubmitting(false);
        return;
      }

      if (isHackathon && !formData.track) {
        toast.error("Please select a track.");
        setSubmitting(false);
        return;
      }

      if (
        isHackathon &&
        formData.projectUrl &&
        !formData.projectUrl.startsWith("https://github.com/")
      ) {
        toast.error("Project URL must start with https://github.com/");
        setSubmitting(false);
        return;
      }
      if (formData.projectUrl && !formData.projectUrl.startsWith("https://")) {
        toast.error("Project URL must start with https://");
        setSubmitting(false);
        return;
      }

      let teamId: Id<"teams">;
      if (editingTeam && onSubmitEdit) {
        await onSubmitEdit({
          teamId: editingTeam._id,
          name,
          description: formData.description.trim(),
          members,
          entrantEmails,
          ...(isDemoDay
            ? { courseCode: formData.courseCode || undefined }
            : isHackathon
              ? {
                track: formData.track || undefined,
                projectUrl: formData.projectUrl || undefined,
              }
              : {
                  projectUrl: formData.projectUrl || undefined,
                }),
        });
        teamId = editingTeam._id;
        if (isHackathon) {
          await setTeamPrizeSubmissionsAdmin({
            eventId,
            teamId,
            prizeIds: selectedPrizeIds as Id<"prizes">[],
          });
        }
        toast.success(`${entityLabel} updated successfully!`);
      } else {
        teamId = await onSubmit({
          eventId,
          name,
          description: formData.description.trim(),
          members,
          entrantEmails,
          ...(isDemoDay
            ? { courseCode: formData.courseCode || undefined }
            : isHackathon
              ? {
                track: formData.track || undefined,
                projectUrl: formData.projectUrl || undefined,
              }
              : {
                  projectUrl: formData.projectUrl || undefined,
                }),
        });
        if (isHackathon) {
          await setTeamPrizeSubmissionsAdmin({
            eventId,
            teamId,
            prizeIds: selectedPrizeIds as Id<"prizes">[],
          });
        }
        toast.success(`${entityLabel} added successfully!`);
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || `Failed to save ${entityLabel.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full">
      <div className="relative w-full h-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h3 className="text-xl font-heading font-bold text-foreground">
            {editingTeam ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {editingTeam
              ? `Editing existing ${entityLabel.toLowerCase()} details.`
              : `Create one ${entityLabel.toLowerCase()} manually or import a CSV.`}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {!editingTeam && (
              <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      Bulk Import From CSV
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Upload a spreadsheet instead of entering {entityLabel.toLowerCase()}s one at a time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-secondary text-sm"
                  >
                    Download Template
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importingCsv || (isHackathon && !!prizesLoading)}
                    className="btn-secondary"
                  >
                    Choose CSV
                  </button>
                  <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {csvImportPlan
                      ? `${csvImportPlan.fileName} loaded with ${csvImportPlan.rows.length} ${entityLabel.toLowerCase()}${csvImportPlan.rows.length === 1 ? "" : "s"}.`
                      : isDemoDay
                        ? "Required columns: name, members, courseCode. Optional: description."
                        : isCodeAndTell
                          ? "Required columns: name, entrantEmails. Optional: description, members, projectUrl."
                          : "Required columns: name, members, track. Optional: description, projectUrl, prizes."}
                  </div>
                  {csvImportPlan && (
                    <>
                      <button
                        type="button"
                        onClick={handleImportCsv}
                        disabled={
                          importingCsv || (isHackathon && !!prizesLoading)
                        }
                        className="btn-primary"
                      >
                        {importingCsv
                          ? "Importing..."
                          : `Import ${csvImportPlan.rows.length} ${entityLabel}${csvImportPlan.rows.length === 1 ? "" : "s"}`}
                      </button>
                      <button
                        type="button"
                        onClick={resetCsvImport}
                        disabled={importingCsv}
                        className="btn-secondary"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isDemoDay
                    ? "Use semicolons inside the `members` cell, or provide separate `member1`, `member2`, ... columns."
                    : isCodeAndTell
                      ? "Use semicolons or commas inside the `entrantEmails` cell. `members` remains optional."
                      : "Use semicolons inside the `members` and `prizes` cells, or provide separate `member1`, `member2`, ... columns. Prize names must match this event's prize names exactly."}
                </p>
                {!!prizesLoading && isHackathon && (
                  <p className="text-xs text-muted-foreground">
                    Waiting for prizes to load before imports can run.
                  </p>
                )}
                {csvImportNotice && (
                  <div
                    className={`rounded-lg border p-3 ${
                      csvImportNotice.tone === "error"
                        ? "border-red-500/30 bg-red-500/5"
                        : csvImportNotice.tone === "success"
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border bg-card"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {csvImportNotice.summary}
                    </p>
                    {csvImportNotice.details.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {csvImportNotice.details
                          .slice(0, MAX_VISIBLE_IMPORT_DETAILS)
                          .map((detail) => (
                            <p key={detail}>{detail}</p>
                          ))}
                        {csvImportNotice.details.length >
                          MAX_VISIBLE_IMPORT_DETAILS && (
                          <p>
                            +
                            {csvImportNotice.details.length -
                              MAX_VISIBLE_IMPORT_DETAILS}{" "}
                            more row
                            {csvImportNotice.details.length -
                              MAX_VISIBLE_IMPORT_DETAILS ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {!editingTeam && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Or add one manually
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {entityLabel} Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input w-full"
                placeholder="Code Crusaders"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="input w-full min-h-[80px] py-2 resize-none"
                placeholder="AI-powered study assistant"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Members (comma-separated){" "}
                {!isCodeAndTell && <span className="text-red-500">*</span>}
                {isCodeAndTell && (
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                )}
              </label>
              <input
                type="text"
                required={!isCodeAndTell}
                value={formData.members}
                onChange={(e) =>
                  setFormData({ ...formData, members: e.target.value })
                }
                className="input w-full"
                placeholder="Alice Smith, Bob Johnson, Carol Lee"
              />
            </div>
            {isCodeAndTell && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Entrant Emails <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.entrantEmails}
                  onChange={(e) =>
                    setFormData({ ...formData, entrantEmails: e.target.value })
                  }
                  className="input w-full"
                  placeholder="alice@example.com, bob@example.com"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Users tied to these emails can sign in and vote, but they
                  cannot rank this project.
                </p>
              </div>
            )}
            {isDemoDay ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Course <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.courseCode}
                  onChange={(e) =>
                    setFormData({ ...formData, courseCode: e.target.value })
                  }
                  className="input w-full"
                >
                  <option value="">Select course...</option>
                  {(courseCodes || []).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            ) : isHackathon ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Track <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.track}
                    onChange={(e) =>
                      setFormData({ ...formData, track: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option value="">Select track...</option>
                    {(tracks || []).map((trackOption) => (
                      <option key={trackOption} value={trackOption}>
                        {trackOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Project URL{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="url"
                    value={formData.projectUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, projectUrl: e.target.value })
                    }
                    className="input w-full"
                    placeholder="https://github.com/team/project"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Prize Submissions
                  </label>
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Sponsor Filter
                    </label>
                    <select
                      value={sponsorFilter}
                      onChange={(e) => setSponsorFilter(e.target.value)}
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
                  <div className="rounded-lg border border-border overflow-hidden bg-card max-h-56 overflow-y-auto">
                    <div className="w-full">
                      {prizesLoading && (
                        <div className="p-4 text-sm text-muted-foreground border-t border-border first:border-t-0">
                          Loading prizes...
                        </div>
                      )}
                      {!prizesLoading && (eventPrizes?.length || 0) === 0 && (
                        <div className="p-4 text-sm text-muted-foreground border-t border-border first:border-t-0">
                          No prizes configured for this event.
                        </div>
                      )}
                      {!prizesLoading &&
                        (eventPrizes?.length || 0) > 0 &&
                        eligiblePrizes.length === 0 && (
                          <div className="p-4 text-sm text-muted-foreground border-t border-border first:border-t-0">
                            Select a track to see track-specific prizes.
                          </div>
                        )}
                      {!prizesLoading &&
                        eligiblePrizes.length > 0 &&
                        filteredPrizes.length === 0 && (
                          <div className="p-4 text-sm text-muted-foreground border-t border-border first:border-t-0">
                            No prizes match this sponsor filter.
                          </div>
                        )}
                      {filteredPrizes.map((prize: any) => {
                        const checked = selectedPrizeIds.includes(
                          String(prize._id),
                        );
                        return (
                          <label
                            key={prize._id}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors relative group border-t border-border first:border-t-0 ${
                              checked
                                ? "bg-teal-500/10 border-l-2 border-l-teal-500"
                                : "hover:bg-muted/20 border-l-2 border-l-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const id = String(prize._id);
                                if (e.target.checked) {
                                  setSelectedPrizeIds((prev) =>
                                    prev.includes(id) ? prev : [...prev, id],
                                  );
                                } else {
                                  setSelectedPrizeIds((prev) =>
                                    prev.filter((value) => value !== id),
                                  );
                                }
                              }}
                              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {prize.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {prize.type === "general" && "General prize"}
                                {prize.type === "track" &&
                                  `Track prize${prize.track ? ` · ${prize.track}` : ""}`}
                                {prize.type === "sponsor" &&
                                  `Sponsor prize${prize.sponsorName ? ` · ${prize.sponsorName}` : ""}`}
                                {prize.type === "track_sponsor" &&
                                  `Track + Sponsor${prize.track ? ` · ${prize.track}` : ""}${
                                    prize.sponsorName
                                      ? ` · ${prize.sponsorName}`
                                      : ""
                                  }`}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Select every prize this team is applying for.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Project URL{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </label>
                <input
                  type="url"
                  value={formData.projectUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, projectUrl: e.target.value })
                  }
                  className="input w-full"
                  placeholder="https://example.com/project"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || importingCsv}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : editingTeam ? (
                  "Save Changes"
                ) : (
                  `Create ${entityLabel}`
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || importingCsv}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

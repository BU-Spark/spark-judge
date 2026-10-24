import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { errorMessage } from "../../../lib/operationOutcome";
import {
  planDevpostImport,
  type DevpostExistingTeam,
  type DevpostImportPlan,
  type DevpostPrize,
  type DevpostTeam,
} from "./devpostCsv";

type ImportResult = {
  fileName: string;
  added: number;
  updated: number;
  unchanged: number;
  failures: string[];
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function List({
  title,
  hint,
  items,
  tone = "neutral",
}: {
  title: string;
  hint?: string;
  items: string[];
  tone?: "neutral" | "warning";
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={`rounded-md border p-3 text-sm space-y-1 ${tone === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}
    >
      <p className="font-medium fi-ink">{title}</p>
      {hint && <p className="text-xs fi-muted">{hint}</p>}
      <ul className="list-disc pl-5 space-y-1 fi-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DevpostImport({
  eventId,
  tracks,
  prizes,
  existingTeams,
}: {
  eventId: Id<"events">;
  tracks: string[];
  prizes: DevpostPrize[];
  existingTeams: DevpostExistingTeam[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createTeam = useMutation(api.teams.createTeam);
  const updateTeam = useMutation(api.teams.updateTeamAdmin);
  const setPrizes = useMutation(api.prizes.setTeamPrizeSubmissionsAdmin);
  const [loaded, setLoaded] = useState<{
    fileName: string;
    plan: DevpostImportPlan;
  } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so choosing the same file again still triggers a read.
    event.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const plan = planDevpostImport(await file.text(), {
        tracks,
        prizes,
        existingTeams,
      });
      setLoaded({ fileName: file.name, plan });
      setReadError(null);
      setUpdateExisting(true);
    } catch (error) {
      setLoaded(null);
      setReadError(errorMessage(error, "Couldn't read that file."));
    }
  };

  const newTeams = loaded?.plan.teams.filter((team) => !team.existingTeamId) ?? [];
  const matchedTeams = loaded?.plan.teams.filter((team) => team.existingTeamId) ?? [];
  const toUpdate = updateExisting ? matchedTeams : [];
  const workCount = newTeams.length + toUpdate.length;

  const saveTeam = async (team: DevpostTeam) => {
    const fields = {
      name: team.name,
      description: team.description,
      members: team.members,
      entrantEmails: team.entrantEmails,
      projectUrl: team.projectUrl || undefined,
      githubUrl: team.githubUrl || undefined,
      devpostUrl: team.devpostUrl || undefined,
      track: team.track,
    };
    let teamId = team.existingTeamId as Id<"teams"> | undefined;
    if (teamId) {
      await updateTeam({ teamId, ...fields });
    } else {
      teamId = await createTeam({ eventId, ...fields });
    }
    // Replaces earlier entries, so entries always match the Devpost opt-ins.
    if (team.prizeIds.length > 0 || team.existingTeamId) {
      await setPrizes({
        eventId,
        teamId,
        prizeIds: team.prizeIds as Id<"prizes">[],
      });
    }
  };

  const runImport = async () => {
    if (!loaded) return;
    setConfirmOpen(false);
    setRunning(true);
    const outcome: ImportResult = {
      fileName: loaded.fileName,
      added: 0,
      updated: 0,
      unchanged: updateExisting ? 0 : matchedTeams.length,
      failures: [],
    };
    try {
      for (const team of [...newTeams, ...toUpdate]) {
        try {
          await saveTeam(team);
          if (team.existingTeamId) outcome.updated += 1;
          else outcome.added += 1;
        } catch (error) {
          outcome.failures.push(
            `${team.name}: ${errorMessage(error, "Couldn't save this team.")}`,
          );
        }
      }
    } finally {
      setRunning(false);
      setResult(outcome);
      // A retry must re-read the file so teams saved this time are matched
      // and updated rather than created twice.
      setLoaded(null);
      const saved = outcome.added + outcome.updated;
      if (outcome.failures.length === 0) {
        toast.success(`Saved ${plural(saved, "team")} from Devpost.`);
      } else {
        toast.error(
          `Saved ${plural(saved, "team")}. ${plural(outcome.failures.length, "team")} couldn't be saved.`,
        );
      }
    }
  };

  const startImport = () => {
    if (toUpdate.length > 0) setConfirmOpen(true);
    else void runImport();
  };

  const plan = loaded?.plan;
  const skippedDrafts = plan
    ? Object.entries(plan.notSubmitted)
        .map(([status, count]) => `${count} ${status.toLowerCase()}`)
        .join(", ")
    : "";
  const prizeNotes = plan
    ? plan.teams.flatMap((team) =>
        team.skippedPrizes.map((note) => `${team.name}: ${note}`),
      )
    : [];

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold fi-ink">Import from Devpost</h4>
        <p className="text-sm fi-muted">
          Upload the project export from Devpost (Manage Hackathon → Projects →
          Export). Only submitted projects are imported. Teams are entered only
          for the prizes they opted into on Devpost. Import again any time to
          add late submissions.
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Devpost export file"
        onChange={(event) => void handleFile(event)}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="fi-key"
          disabled={running}
          onClick={() => fileInputRef.current?.click()}
        >
          {loaded ? "Choose a different export" : "Choose Devpost export"}
        </button>
        {loaded && (
          <button
            type="button"
            className="fi-transport"
            disabled={running || workCount === 0}
            onClick={startImport}
          >
            {running
              ? "Importing…"
              : workCount === 0
                ? "Nothing to import"
                : `Import ${plural(workCount, "team")}`}
          </button>
        )}
      </div>

      {readError && (
        <p role="alert" className="text-sm text-red-700">
          {readError}
        </p>
      )}

      {plan && loaded && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm fi-ink">
            <b>{loaded.fileName}</b>: {plural(plan.totalProjects, "project")}
            {skippedDrafts && ` (${skippedDrafts} not submitted, skipped)`}.
          </p>
          <ul className="text-sm fi-muted space-y-1">
            <li>
              <b className="fi-ink">{newTeams.length}</b> new{" "}
              {newTeams.length === 1 ? "team" : "teams"} to add
            </li>
            {matchedTeams.length > 0 && (
              <li>
                <b className="fi-ink">{matchedTeams.length}</b> already in
                HackJudge{" "}
                <label className="inline-flex items-center gap-1 ml-2">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(event) => setUpdateExisting(event.target.checked)}
                  />
                  update them from Devpost
                </label>
              </li>
            )}
          </ul>
          <List
            tone="warning"
            title={`Not imported: ${plural(plan.problems.length, "team")} ${plan.problems.length === 1 ? "needs" : "need"} a fix`}
            hint="Everything else imports normally. Fix these, then import the same file again."
            items={plan.problems.map(
              (problem) => `${problem.name}: ${problem.reason} ${problem.fix}`,
            )}
          />
          <List
            title={`Prize opt-ins not entered (${prizeNotes.length})`}
            hint="The team is imported; only these prize entries are left out."
            items={prizeNotes}
          />
        </div>
      )}

      {result && (
        <div className="space-y-2" aria-live="polite">
          <p
            className={`text-sm ${result.failures.length ? "text-red-700" : "fi-ink"}`}
          >
            From {result.fileName}: added {plural(result.added, "team")}
            {result.updated > 0 && `, updated ${result.updated}`}
            {result.unchanged > 0 && `, left ${result.unchanged} unchanged`}.
          </p>
          <List
            tone="warning"
            title={`Couldn't save ${plural(result.failures.length, "team")}`}
            hint="Import the same file again to retry. Teams that were saved won't be duplicated."
            items={result.failures}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Update ${plural(toUpdate.length, "team")} already in HackJudge?`}
        confirmLabel={
          newTeams.length > 0
            ? `Add ${newTeams.length} and update ${toUpdate.length}`
            : `Update ${toUpdate.length}`
        }
        cancelLabel="Go back"
        onConfirm={() => void runImport()}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          These teams match by Devpost link or name. Their details, members,
          and prize entries will be replaced with what's on Devpost now, so
          edits made in HackJudge for them will be overwritten. Scores aren't
          affected.
        </p>
        <p className="mt-2 text-sm fi-muted">
          {toUpdate
            .slice(0, 8)
            .map((team) => team.name)
            .join(", ")}
          {toUpdate.length > 8 && `, and ${toUpdate.length - 8} more`}
        </p>
        <p className="mt-2 text-sm fi-muted">
          To add only new teams, go back and untick “update them from Devpost”.
        </p>
      </ConfirmDialog>
    </div>
  );
}

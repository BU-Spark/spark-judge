import { useEffect, useMemo, useState } from "react";
import { useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  computeAssignmentProgress,
  judgeActivityStatus,
  judgeLeniency,
  type JudgeActivityStatus,
  type ScoreRecord,
} from "../../../../shared/judgingInsights";
import {
  getHackathonReadiness,
  summarizeReadiness,
  type ReadinessFixTarget,
} from "../../../../shared/hackathonReadiness";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { InlineFailure } from "../../../components/ui/TaskStatus";
import type {
  OperationResult,
  RecoverableFailure,
} from "../../../lib/operationOutcome";
import { EventLifecycle } from "../judging/EventLifecycle";
import { HACKATHON_STEPS, getHackathonPhase } from "../judging/hackathonPhase";
import { ReadinessChecklist } from "../judging/ReadinessChecklist";
import { formatAgo } from "../judging/formatAgo";
import "../judging/judging.css";

type JudgingProgress = FunctionReturnType<
  typeof api.judgeAssignments.getJudgingProgress
>;

/** Re-render every 30s so "active" and "x min ago" stay honest. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const ACTIVITY_LABEL: Record<JudgeActivityStatus, string> = {
  awaiting_code: "Hasn't entered code",
  not_started: "No scores yet",
  active: "Active",
  idle: "Idle",
  done: "Finished queue",
};

export function HackathonOverviewTab({
  event,
  status,
  prizes,
  detailedScores,
  locking,
  onNavigate,
  onLockScoring,
}: {
  event: any;
  status: "upcoming" | "active" | "past";
  prizes: any[] | undefined;
  detailedScores: any;
  locking: boolean;
  onNavigate: (target: ReadinessFixTarget | "scores" | "results") => void;
  /** Resolves with a failure instead of throwing; the dialog stays open on failure. */
  onLockScoring: () => Promise<OperationResult>;
}) {
  const eventId = event._id as Id<"events">;
  // useQueries reports a missing or failing function as a value instead of
  // throwing, so the board still works before the query is deployed.
  const progressQueries = useMemo(
    () => ({
      progress: { query: api.judgeAssignments.getJudgingProgress, args: { eventId } },
    }),
    [eventId],
  );
  const progressResult = useQueries(progressQueries).progress as
    | JudgingProgress
    | Error
    | undefined;
  const progressError = progressResult instanceof Error;
  const progress = progressError ? null : progressResult;
  const [confirmLock, setConfirmLock] = useState(false);
  const [lockFailure, setLockFailure] = useState<RecoverableFailure | null>(
    null,
  );
  const confirmLockScoring = async () => {
    setLockFailure(null);
    const result = await onLockScoring();
    if (result.ok) setConfirmLock(false);
    else setLockFailure(result.failure);
  };
  const now = useNow();

  const scoringLocked = Boolean(event.scoringLockedAt);
  const phase = getHackathonPhase({
    status,
    scoringLocked,
    resultsReleased: Boolean(event.resultsReleased),
  });

  const teams: any[] = useMemo(() => event.teams ?? [], [event.teams]);
  const visibleTeams = teams.filter((team) => !team.hidden);
  const teamNames = useMemo(
    () => new Map(teams.map((team) => [String(team._id), team.name as string])),
    [teams],
  );

  const scores: ScoreRecord[] = useMemo(
    () =>
      (detailedScores?.teamRankings ?? []).flatMap((row: any) =>
        (row.scores ?? []).map((score: any) => ({
          judgeId: String(score.judgeId),
          teamId: String(score.teamId),
          totalScore: score.totalScore,
          submittedAt: score.submittedAt,
        })),
      ),
    [detailedScores],
  );

  const scoredTeamIds = useMemo(
    () => new Set(scores.map((score) => score.teamId)),
    [scores],
  );
  const leniency = useMemo(
    () => new Map(judgeLeniency(scores).map((row) => [row.judgeId, row])),
    [scores],
  );

  const judges = useMemo(() => progress?.judges ?? [], [progress]);

  const checks = getHackathonReadiness({
    judgeCode: event.judgeCode,
    categoryCount: (event.categories ?? []).length,
    activePrizeCount:
      prizes === undefined
        ? null
        : prizes.filter((prize) => prize.isActive !== false).length,
    teams: teams.map((team) => ({
      _id: String(team._id),
      name: team.name,
      hidden: team.hidden,
      track: team.track,
      githubUrl: team.githubUrl,
      submittedBy: team.submittedBy,
    })),
    // Without the progress query we can't count judges, so skip that check.
    judgesRegistered: progress ? judges.length : null,
    eventStatus: status,
    startDate: event.startDate,
    endDate: event.endDate,
  });
  const readiness = summarizeReadiness(checks);

  // Cohort judging: each judge scores the teams assigned to them.
  const assignment = useMemo(
    () =>
      progress
        ? computeAssignmentProgress(
            teams,
            judges.map((judge) => ({
              judgeId: String(judge.judgeId),
              name: judge.name,
              claimedTeamIds: judge.claimedTeamIds.map(String),
              scoredTeamIds: judge.scoredTeamIds.map(String),
            })),
          )
        : null,
    [progress, teams, judges],
  );

  const judgeRows = judges
    .map((judge) => {
      const activity = judgeActivityStatus(
        {
          verified: judge.verified,
          claimedCount: judge.claimedTeamIds.length,
          scoredCount: judge.scoredTeamIds.length,
          lastScoredAt: judge.lastScoredAt,
          cohortsEnabled: Boolean(progress?.cohortsEnabled),
        },
        now,
      );
      return { ...judge, activity, leniency: leniency.get(String(judge.judgeId)) };
    })
    .sort(
      (a, b) =>
        b.scoredTeamIds.length - a.scoredTeamIds.length || a.name.localeCompare(b.name),
    );

  const activityCounts = judgeRows.reduce<Record<JudgeActivityStatus, number>>(
    (counts, judge) => ({ ...counts, [judge.activity]: counts[judge.activity] + 1 }),
    { awaiting_code: 0, not_started: 0, active: 0, idle: 0, done: 0 },
  );
  const assignedTotal = judges.reduce((sum, judge) => sum + judge.claimedTeamIds.length, 0);
  const assignedScored = judges.reduce((sum, judge) => {
    const scored = new Set(judge.scoredTeamIds.map(String));
    return sum + judge.claimedTeamIds.filter((id) => scored.has(String(id))).length;
  }, 0);
  const unassigned = assignment?.filter((row) => row.status === "unassigned") ?? [];
  const waiting = assignment?.filter((row) => row.status === "waiting") ?? [];
  const completeTeams = assignment?.filter((row) => row.status === "complete").length ?? 0;
  const missingScores = waiting.reduce((sum, row) => sum + row.waitingOn.length, 0);
  // Without assignment data, the best we can show is teams nobody has scored.
  const unscoredTeams = visibleTeams.filter((team) => !scoredTeamIds.has(String(team._id)));
  const conflicts = judgeRows.filter((judge) => judge.possibleConflictTeamIds.length > 0);
  const scoresLoading = detailedScores === undefined;
  const showLive = status !== "upcoming" || scores.length > 0;

  const copyMissingScores = async () => {
    const lines = assignment
      ? [
          ...unassigned.map((row) => `• ${row.name} — no judges assigned`),
          ...waiting.map((row) => `• ${row.name} — waiting on ${row.waitingOn.join(", ")}`),
        ]
      : unscoredTeams.map((team) => `• ${team.name} — no scores yet`);
    const text = [`${event.name}: missing scores`, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("List copied");
    } catch {
      toast.error("Couldn't copy. Select the list and copy it manually.");
    }
  };

  const nextAction = (() => {
    if (phase === "setup") {
      return readiness.blockers > 0 ? (
        <p>
          <strong>
            {readiness.blockers} {readiness.blockers === 1 ? "blocker" : "blockers"}
          </strong>{" "}
          to fix before {new Date(event.startDate).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.
        </p>
      ) : (
        <p>
          Ready. Judges can enter the code now. Scoring opens{" "}
          {new Date(event.startDate).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
        </p>
      );
    }
    if (phase === "judging") {
      return (
        <>
          <p>Lock scoring when judging is finished.</p>
          <button type="button" className="fi-transport" onClick={() => setConfirmLock(true)} disabled={locking}>
            Lock scoring
          </button>
        </>
      );
    }
    if (phase === "deliberate") {
      return scoringLocked ? (
        <>
          <p>Scoring is locked. Review the rankings, then choose winners.</p>
          <button type="button" className="fi-transport" onClick={() => onNavigate("results")}>
            Choose winners
          </button>
        </>
      ) : (
        <>
          <p>The event has ended. Lock scoring to start deliberation.</p>
          <button type="button" className="fi-transport" onClick={() => setConfirmLock(true)} disabled={locking}>
            Lock scoring
          </button>
        </>
      );
    }
    return (
      <>
        <p>Results are published.</p>
        <a className="fi-key" href={`/event/${eventId}`} target="_blank" rel="noreferrer">
          View public results
        </a>
      </>
    );
  })();

  const readinessSection = (
    <section className="admin-overview-section" aria-labelledby="readiness-title">
      <div className="admin-overview-heading">
        <div>
          <h2 id="readiness-title">Readiness</h2>
          <p>
            {readiness.blockers === 0 && readiness.warnings === 0
              ? "Everything checks out."
              : [
                  readiness.blockers > 0 &&
                    `${readiness.blockers} ${readiness.blockers === 1 ? "blocker" : "blockers"}`,
                  readiness.warnings > 0 &&
                    `${readiness.warnings} to check`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
      </div>
      <ReadinessChecklist checks={checks} onFix={onNavigate} />
    </section>
  );

  return (
    <div className="admin-overview">
      <EventLifecycle steps={HACKATHON_STEPS} currentId={phase} nextAction={nextAction} />

      {(!showLive || readiness.blockers > 0) && readinessSection}

      {showLive && scoresLoading && <p className="admin-muted">Loading judging progress…</p>}

      {showLive && !scoresLoading && (
        <>
          <section className="admin-overview-stats" aria-label="Judging progress">
            <div>
              <span>{assignment ? "Assigned scores in" : "Scorecards"}</span>
              {assignment && assignedTotal > 0 ? (
                <>
                  <strong>
                    {assignedScored}
                    <small> / {assignedTotal}</small>
                  </strong>
                  <meter min={0} max={assignedTotal} value={assignedScored} aria-label="Assigned scores submitted" />
                </>
              ) : (
                <>
                  <strong>{scores.length}</strong>
                  <p>{assignment ? "No teams assigned to judges yet" : "submitted so far"}</p>
                </>
              )}
            </div>
            <div>
              <span>{assignment ? "Teams fully scored" : "Teams with scores"}</span>
              {assignment ? (
                <>
                  <strong>
                    {completeTeams}
                    <small> / {visibleTeams.length}</small>
                  </strong>
                  <meter min={0} max={Math.max(1, visibleTeams.length)} value={completeTeams} aria-label="Teams with every assigned score in" />
                </>
              ) : (
                <>
                  <strong>
                    {visibleTeams.length - unscoredTeams.length}
                    <small> / {visibleTeams.length}</small>
                  </strong>
                  <p>at least one judge has scored</p>
                </>
              )}
            </div>
            <div>
              <span>Judges active (15 min)</span>
              {progress ? (
                <>
                  <strong>
                    {activityCounts.active}
                    <small> / {judges.length}</small>
                  </strong>
                  <p>
                    {activityCounts.awaiting_code > 0 && `${activityCounts.awaiting_code} without code · `}
                    {activityCounts.not_started} not started
                  </p>
                </>
              ) : (
                <strong>—</strong>
              )}
            </div>
          </section>

          <div className="admin-overview-grid">
            <section className="admin-overview-section" aria-labelledby="missing-title">
              <div className="admin-overview-heading">
                <div>
                  <h2 id="missing-title">Missing scores</h2>
                  <p>
                    {assignment
                      ? unassigned.length + waiting.length === 0
                        ? "Every assigned judge has scored their teams."
                        : [
                            unassigned.length > 0 &&
                              `${unassigned.length} ${unassigned.length === 1 ? "team has" : "teams have"} no judges assigned`,
                            waiting.length > 0 &&
                              `${missingScores} ${missingScores === 1 ? "score" : "scores"} outstanding`,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                      : unscoredTeams.length === 0
                        ? "Every visible team has at least one score."
                        : `${unscoredTeams.length} ${unscoredTeams.length === 1 ? "team has" : "teams have"} no scores. Judge assignments aren't available yet.`}
                  </p>
                </div>
                {(assignment ? unassigned.length + waiting.length : unscoredTeams.length) > 0 && (
                  <button type="button" className="fi-key" onClick={() => void copyMissingScores()}>
                    Copy list
                  </button>
                )}
              </div>
              {assignment ? (
                unassigned.length + waiting.length > 0 && (
                  <ul className="admin-missing-list">
                    {[...unassigned, ...waiting].map((row) => (
                      <li key={row.teamId} data-status={row.status}>
                        <span className="admin-coverage-name">{row.name}</span>
                        <span className="admin-missing-detail">
                          {row.status === "unassigned"
                            ? "No judges assigned"
                            : `Waiting on ${row.waitingOn.join(", ")}`}
                          {row.status === "waiting" && (
                            <small>
                              {row.assigned.length - row.waitingOn.length} of {row.assigned.length} assigned judges scored
                            </small>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                unscoredTeams.length > 0 && (
                  <ul className="admin-missing-list">
                    {unscoredTeams.map((team) => (
                      <li key={String(team._id)} data-status="unassigned">
                        <span className="admin-coverage-name">{team.name}</span>
                        <span className="admin-missing-detail">No scores yet</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>

            <section className="admin-overview-section" aria-labelledby="judges-title">
              <div className="admin-overview-heading">
                <div>
                  <h2 id="judges-title">Judges</h2>
                  <p>
                    Scores appear when a judge submits. Drafts on a judge's device aren't counted.
                  </p>
                </div>
              </div>
              {progress === undefined ? (
                <p className="admin-muted">Loading judges…</p>
              ) : progress === null ? (
                <p className="admin-muted">
                  {progressError
                    ? "Judge details couldn't load. The judging progress function may not be deployed to this Convex deployment yet."
                    : "Judge details aren't available."}
                </p>
              ) : judgeRows.length === 0 ? (
                <p className="admin-muted">
                  No judges have registered. Judges sign in, open the event, and choose “Join as judge.”
                </p>
              ) : (
                <div className="admin-judges-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Judge</th>
                        <th scope="col">Status</th>
                        <th scope="col">Scored</th>
                        <th scope="col">Last submit</th>
                        <th scope="col">
                          <abbr title="Judge's average total compared with the event average">vs avg</abbr>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {judgeRows.map((judge) => (
                        <tr key={judge.judgeId}>
                          <td>
                            <span className="admin-judge-name">{judge.name}</span>
                            {judge.email && judge.email !== judge.name && <small>{judge.email}</small>}
                            {judge.possibleConflictTeamIds.length > 0 && (
                              <small className="admin-flag">
                                Listed on {judge.possibleConflictTeamIds.map((id) => teamNames.get(String(id)) ?? "a team").join(", ")}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className="admin-chip" data-activity={judge.activity}>
                              {ACTIVITY_LABEL[judge.activity]}
                            </span>
                          </td>
                          <td className="admin-num">
                            {judge.scoredTeamIds.length}
                            {progress.cohortsEnabled && <small> of {judge.claimedTeamIds.length} assigned</small>}
                          </td>
                          <td>{formatAgo(judge.lastScoredAt, now)}</td>
                          <td className="admin-num">
                            {judge.leniency && judge.leniency.count >= 2
                              ? `${judge.leniency.offset >= 0 ? "+" : "−"}${Math.abs(judge.leniency.offset).toFixed(1)}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {readiness.blockers === 0 && (
            <details className="admin-overview-setup">
              <summary>
                Setup checks{readiness.warnings > 0 ? ` · ${readiness.warnings} to check` : ""}
              </summary>
              {readinessSection}
            </details>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmLock}
        title="Lock scoring?"
        confirmLabel="Lock scoring"
        busy={locking}
        onCancel={() => {
          setConfirmLock(false);
          setLockFailure(null);
        }}
        onConfirm={() => void confirmLockScoring()}
      >
        <p>Judges won't be able to submit or change scores. You can unlock later if needed.</p>
        {(unassigned.length > 0 || missingScores > 0 || conflicts.length > 0) && (
          <ul>
            {missingScores > 0 && (
              <li>
                {missingScores} assigned {missingScores === 1 ? "score is" : "scores are"} still missing across{" "}
                {waiting.length} {waiting.length === 1 ? "team" : "teams"}.
              </li>
            )}
            {unassigned.length > 0 && (
              <li>
                {unassigned.length} {unassigned.length === 1 ? "team has" : "teams have"} no judges assigned and no scores.
              </li>
            )}
            {conflicts.length > 0 && (
              <li>
                {conflicts.length} {conflicts.length === 1 ? "judge is" : "judges are"} listed on a team. Check their scores before deliberating.
              </li>
            )}
          </ul>
        )}
        {lockFailure && (
          <InlineFailure
            failure={lockFailure}
            title="Scoring is still unlocked"
            onRetry={() => void confirmLockScoring()}
            busy={locking}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}

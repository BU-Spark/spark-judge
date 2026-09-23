import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Id } from "../../../convex/_generated/dataModel";
import { getEventMode } from "../../lib/eventModes";
import { getStagePreview } from "../../lib/eventStagePreview";
import {
  CodeAndTellBallotView,
  type VotingContext,
} from "../code-and-tell/CodeAndTellVoteView";
import {
  DemoDayBrowseView,
  type AppreciationController,
} from "../demo-day/DemoDayBrowse";
import { ScoringSession } from "../ScoringWizard";
import { ParticipationFrame } from "./ParticipationChrome";

export function ParticipationPreview() {
  const [params] = useSearchParams();
  const mode = getEventMode(params.get("mode"));
  return (
    <div className="participation-preview">
      <nav className="participation-preview-nav" aria-label="Scoring previews">
        <Link className="preview-brand" to="/?demo=1">
          HackJudge
        </Link>
        <span>Interactive preview · Sample data only</span>
        <div>
          {(
            [
              ["hackathon", "Hackathon"],
              ["demo_day", "Demo Day"],
              ["code_and_tell", "Code & Tell"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              aria-current={mode === value ? "page" : undefined}
              to={`/participation-preview?mode=${value}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <PreviewSession key={mode} mode={mode} />
    </div>
  );
}

function PreviewSession({ mode }: { mode: ReturnType<typeof getEventMode> }) {
  const { event, teams } = useMemo(() => {
    const fixture = getStagePreview(
      new URLSearchParams({ mode, phase: "live" }),
    );
    const teams = fixture.projects.map((project, index) => ({
      ...project,
      _id: project._id as Id<"teams">,
      description: project.description ?? "",
      members: [
        ["Alex Chen", "Sam Rivera"],
        ["Jordan Lee", "Taylor Brooks"],
        ["Morgan Patel", "Casey Kim"],
        ["Avery James", "Riley Park"],
      ][index],
      courseCode: index < 2 ? "CS 506" : "DS 519",
    }));
    const source = fixture.events[0];
    return {
      event: {
        ...source,
        _id: source._id as Id<"events">,
        name: source.name,
        description: source.description ?? "",
        teams,
        status: "active" as const,
      },
      teams,
    };
  }, [mode]);
  const [ballot, setBallot] = useState<Id<"teams">[]>([]);
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [scoringOpen, setScoringOpen] = useState(true);
  const [scoreReceipt, setScoreReceipt] = useState<number | null>(null);
  const totalTaps = Object.values(taps).reduce((sum, count) => sum + count, 0);
  const context: VotingContext = {
    myEmail: "preview@example.com",
    ownProjectIds: [teams[3]._id],
    requiredRankCount: 3,
    eligibleProjectCount: 3,
    currentBallotTeamIds: ballot,
    maxBallots: null,
    rankedVoteRowCount: ballot.length ? 1 : 0,
    hasSubmittedBallot: !!ballot.length,
    votingClosedToNewVoters: false,
    projects: teams.map((team, index) => ({
      ...team,
      projectUrl: undefined,
      isOwned: index === 3,
      isEligible: index !== 3,
    })),
  };
  const appreciation: AppreciationController = {
    isAuthenticated: true,
    isLoading: false,
    error: null,
    clearError: () => {},
    appreciate: async (_eventId, teamId) => {
      const next = (taps[teamId] ?? 0) + 1;
      if (next > 10 || totalTaps >= 100)
        return {
          success: false,
          error: "Preview limit reached.",
          remainingForTeam: Math.max(0, 10 - (taps[teamId] ?? 0)),
          remainingTotal: Math.max(0, 100 - totalTaps),
        };
      setTaps((previous) => ({ ...previous, [teamId]: next }));
      return {
        success: true,
        remainingForTeam: 10 - next,
        remainingTotal: 100 - totalTaps - 1,
      };
    },
  };
  const onBack = () => {
    window.location.href = `/?demo=1&mode=${mode}&phase=live`;
  };
  return (
    <ParticipationFrame mode={mode}>
      {mode === "code_and_tell" ? (
        <CodeAndTellBallotView
          eventId={event._id}
          event={event}
          onBack={onBack}
          loggedInUser={{ _id: "preview-user", email: "preview@example.com" }}
          publicResults={null}
          votingContext={context}
          saveBallot={async ({ rankedTeamIds }) => {
            setBallot([...rankedTeamIds]);
          }}
        />
      ) : mode === "demo_day" ? (
        <DemoDayBrowseView
          eventId={event._id}
          event={event}
          onBack={onBack}
          attendeeId="preview-attendee"
          appreciationData={{
            teams: teams.map((team) => ({
              teamId: team._id,
              totalCount: taps[team._id] ?? 0,
              attendeeCount: taps[team._id] ?? 0,
            })),
            attendeeTotalCount: totalTaps,
            attendeeRemainingBudget: 100 - totalTaps,
            maxPerAttendee: 100,
            maxPerTeam: 10,
          }}
          appreciation={appreciation}
          preview
        />
      ) : scoringOpen ? (
        <ScoringSession
          embedded
          eventId={event._id}
          eventName={event.name}
          teams={teams}
          categories={[
            { name: "Innovation", weight: 2 },
            { name: "Impact", weight: 2 },
            { name: "Execution", weight: 1, optOutAllowed: true },
          ]}
          storageKey="hackjudge:participation-preview:scoring"
          onClose={() => setScoringOpen(false)}
          onSubmitted={() => setScoringOpen(false)}
          submitBatchScores={async ({ scores }) => {
            setScoreReceipt(scores.length);
          }}
        />
      ) : (
        <div className="participation-content preview-receipt">
          <h1>
            {scoreReceipt === null
              ? "Your scoring preview"
              : "Scores submitted in this preview"}
          </h1>
          <p>
            {scoreReceipt === null
              ? "Your draft stays on this browser. Resume to keep exploring."
              : `${scoreReceipt} sample projects scored. No real scores were submitted.`}
          </p>
          <button
            className="participation-primary"
            onClick={() => setScoringOpen(true)}
          >
            {scoreReceipt === null ? "Resume scoring" : "Try again"}
          </button>
        </div>
      )}
    </ParticipationFrame>
  );
}

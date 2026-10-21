import { useState } from "react";
import { ResultsTab } from "./tabs/ResultsTab";
import { PrizeWinnerWizardPanel } from "./panels/PrizeWinnerWizardPanel";
import { DemoDayWinnersPanel } from "./panels/DemoDayWinnersPanel";
import { CodeAndTellWinnerPanel } from "./panels/CodeAndTellWinnerPanel";
import { ScoringDashboard } from "./components/ScoringDashboard";
import type {
  ResultsInput,
  ResultsMode,
} from "../../../shared/resultReadiness";
import type { Id } from "../../../convex/_generated/dataModel";
import "./admin.fi.css";

const eventId = "sample-event" as Id<"events">;
const teams = [
  {
    _id: "garden" as Id<"teams">,
    name: "Community Garden",
    courseCode: "CS 506",
  },
  { _id: "access" as Id<"teams">, name: "Access Map", courseCode: "DS 701" },
  {
    _id: "repair" as Id<"teams">,
    name: "Repair Together",
    courseCode: "CS 506",
  },
];
const prizes = [
  {
    _id: "overall" as Id<"prizes">,
    name: "Best overall project",
    sortOrder: 0,
  },
  { _id: "impact" as Id<"prizes">, name: "Community impact", sortOrder: 1 },
];
const rankings = teams.map((team, index) => ({
  team,
  averageScore: 4.8 - index * 0.4,
  judgeCount: 3,
  categoryAverages: { Innovation: 5 - index, Execution: 4.5 - index * 0.5 },
}));
const detailedScores = {
  teamRankings: rankings,
  categories: ["Innovation", "Execution"],
  categoryRankings: {},
  judgeBreakdown: [],
};
const standings = teams.map((team, index) => ({
  teamId: team._id,
  name: team.name,
  description: "Sample project",
  points: 25 - index * 5,
  ballotsCount: 10,
  rankCounts: [5 - index, 3, 2],
}));
const deliberation = {
  prizes: prizes.map((prize) => ({
    prize,
    candidates: rankings.map((row) => ({
      teamId: row.team._id,
      teamName: row.team.name,
      track: "Community",
      averageScore: row.averageScore,
      judgeCount: row.judgeCount,
    })),
  })),
};

export default function ResultsPreview() {
  const [mode, setMode] = useState<ResultsMode>("hackathon");
  const [revision, setRevision] = useState(0);
  return (
    <div className="fi-admin-shell p-4 sm:p-6">
      <div className="admin-event-filters">
        <div>
          <h1 className="text-2xl font-semibold">Results workflow preview</h1>
          <p>Sample data only. Actions here do not change any event.</p>
        </div>
        <label className="admin-search">
          Event format
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as ResultsMode);
              setRevision((value) => value + 1);
            }}
          >
            <option value="hackathon">Hackathon</option>
            <option value="demo_day">Demo Day</option>
            <option value="code_and_tell">Code &amp; Tell</option>
          </select>
        </label>
        <button
          className="fi-key"
          onClick={() => setRevision((value) => value + 1)}
        >
          Reset sample
        </button>
      </div>
      <PreviewEvent key={`${mode}-${revision}`} mode={mode} />
    </div>
  );
}

function PreviewEvent({ mode }: { mode: ResultsMode }) {
  const [input, setInput] = useState<ResultsInput>({
    mode,
    status: "past",
    scoringLocked: true,
    teams,
    prizes,
    prizeWinners: [{ prizeId: prizes[0]._id, teamId: teams[0]._id }],
    overallWinnerId: teams[0]._id,
    categories: ["Innovation", "Execution"],
    categoryWinners: [],
  });
  const [published, setPublished] = useState(false);
  const [editing, setEditing] = useState(false);
  const [scores, setScores] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const close = () => setEditing(false);
  const editor =
    mode === "hackathon" ? (
      <PrizeWinnerWizardPanel
        eventId={eventId}
        deliberationData={deliberation}
        detailedScores={detailedScores}
        existingWinners={
          input.prizeWinners as Array<{
            prizeId: Id<"prizes">;
            teamId: Id<"teams">;
          }>
        }
        onClose={close}
        onSubmit={async ({ winners }) => {
          setInput((current) => ({ ...current, prizeWinners: winners }));
        }}
      />
    ) : mode === "demo_day" ? (
      <DemoDayWinnersPanel
        eventId={eventId}
        teams={teams}
        categories={input.categories}
        existingOverallWinner={input.overallWinnerId as Id<"teams">}
        existingCategoryWinners={
          input.categoryWinners as Array<{
            category: string;
            teamId: Id<"teams">;
          }>
        }
        rankings={teams.map((team, index) => ({
          teamId: team._id,
          cleanScore: 123 - index * 20,
        }))}
        onClose={close}
        onSubmit={async ({ overallWinner, categoryWinners }) => {
          setInput((current) => ({
            ...current,
            overallWinnerId: overallWinner,
            categoryWinners,
          }));
        }}
      />
    ) : (
      <CodeAndTellWinnerPanel
        eventId={eventId}
        standings={standings}
        defaultWinnerId={teams[0]._id}
        selectedWinnerId={input.overallWinnerId as Id<"teams">}
        totalBallots={10}
        onClose={close}
        onSubmit={async ({ winnerTeamId }) => {
          setInput((current) => ({
            ...current,
            overallWinnerId: winnerTeamId,
          }));
        }}
      />
    );
  return (
    <>
      <div className="admin-event-nav flex flex-wrap gap-2 mb-4">
        <button className="fi-key" onClick={() => setScores(false)}>
          Results
        </button>
        <button className="fi-key" onClick={() => setScores(true)}>
          Scores
        </button>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={failNext}
            onChange={(event) => setFailNext(event.target.checked)}
          />
          Simulate publication failure
        </label>
      </div>
      {scores ? (
        <ScoringDashboard
          scores={detailedScores}
          viewMode="table"
          setViewMode={() => {}}
        />
      ) : (
        <ResultsTab
          input={input}
          eventName="Community Demo Night"
          publicUrl="/admin-results-preview"
          published={published}
          editing={editing}
          editor={editor}
          onEdit={() => setEditing(true)}
          onScores={() => setScores(true)}
          onPrizes={() => {}}
          onFinish={async () =>
            setInput((current) => ({ ...current, status: "past" }))
          }
          onLock={async () =>
            setInput((current) => ({ ...current, scoringLocked: true }))
          }
          locking={false}
          onPublish={async () => {
            if (failNext) {
              setFailNext(false);
              throw new Error(
                "Sample connection failure. Your selections are saved. Try publishing again.",
              );
            }
            setPublished(true);
          }}
          onWithdraw={async () => setPublished(false)}
        />
      )}
    </>
  );
}

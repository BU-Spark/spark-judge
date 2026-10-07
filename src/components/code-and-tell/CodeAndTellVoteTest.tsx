import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { CodeAndTellBallotView, type BallotProps, type VotingContext } from "./CodeAndTellVoteView";
import { CodeAndTellWorkspace } from "./CodeAndTellWorkspace";
import { ParticipationFrame } from "../participation/ParticipationChrome";

// This adapter deliberately has no Convex hooks or mutation client.
// The homepage supplies public event data; every ballot change stays in memory.
export function CodeAndTellVoteTest(props: BallotProps) {
  const [ballot, setBallot] = useState<Id<"teams">[]>([]);
  const event = { ...props.event, codeAndTellPhase: "voting" as const, status: "active" as const, resultsReleased: false };
  const projects = event.teams.map((team) => ({
    ...team,
    members: team.members ?? [],
    projectUrl: team.projectUrl ?? team.githubUrl,
    isOwned: false,
    isEligible: true,
  }));
  const votingContext: VotingContext = {
    myEmail: "test@example.com",
    ownProjectIds: [],
    requiredRankCount: Math.min(5, projects.length),
    eligibleProjectCount: projects.length,
    currentBallotTeamIds: ballot,
    maxBallots: null,
    rankedVoteRowCount: ballot.length ? 1 : 0,
    hasSubmittedBallot: ballot.length > 0,
    votingClosedToNewVoters: false,
    projects,
  };
  return (
    <ParticipationFrame mode="code_and_tell">
      <CodeAndTellWorkspace event={event} onBack={props.onBack} contextLabel={props.contextLabel}>
        <CodeAndTellBallotView
          {...props}
          event={event}
          loggedInUser={{ _id: "test-voter", email: "test@example.com" }}
          publicResults={null}
          submittedBallot={ballot}
          votingContext={votingContext}
          saveBallot={async ({ rankedTeamIds }) => { setBallot([...rankedTeamIds]); }}
        />
      </CodeAndTellWorkspace>
    </ParticipationFrame>
  );
}

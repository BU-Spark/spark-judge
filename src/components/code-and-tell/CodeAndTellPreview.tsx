import "./typography-preview.css";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CodeAndTellPhase } from "../../../convex/codeAndTellPhase";
import { CodeAndTellWorkspace } from "./CodeAndTellWorkspace";
import {
  CodeAndTellBallotView,
  type VotingContext,
} from "./CodeAndTellVoteView";
import { ParticipationFrame } from "../participation/ParticipationChrome";
import { getStagePreview } from "../../lib/eventStagePreview";

const sampleProjects = [
  {
    name: "Tab Garden",
    description:
      "A browser extension that turns your abandoned tabs into a searchable reading list. Groups related pages locally, so your browsing history stays on your laptop.",
    members: ["Maya Chen", "Jordan Ellis"],
  },
  {
    name: "Campus After Hours",
    description:
      "Find a study spot that’s actually open. A campus map with outlet availability, noise levels, and updates from other students.",
    members: ["Sam Rivera"],
  },
  {
    name: "Commit Radio",
    description:
      "A tiny desktop app that builds a soundtrack from your Git activity. Tonight’s demo turns a week of commits into a three-minute mix.",
    members: ["Alex Park", "Nia Johnson"],
  },
  {
    name: "Pantry Pal",
    description:
      "Take a photo of what’s in your fridge and get recipes you can make without another grocery run. Built over a weekend with a vision model and a very small pantry.",
    members: ["Priya Shah", "Leo Martinez"],
  },
  {
    name: "Small Hours",
    description:
      "An e-ink desk companion for focused work. One physical dial sets a timer; your phone stays out of reach.",
    members: ["Chris Nguyen"],
  },
  {
    name: "Read the Room",
    description:
      "Live captions for student presentations, with a shared glossary for unfamiliar technical terms. Audience members can bookmark a moment to revisit later.",
    members: ["Avery Brooks", "Taylor Kim"],
  },
  {
    name: "Patch Notes",
    description:
      "A personal changelog for things you’re learning. Turn daily notes into a weekly recap with links to the projects you worked on.",
    members: ["You", "Morgan Lee"],
  },
].map((project, index) => ({
  ...project,
  _id: `preview-project-${index + 1}` as Id<"teams">,
  projectUrl: undefined,
  isOwned: index === 6,
  isEligible: index !== 6,
}));

export function CodeAndTellPreview({
  homepage = false,
  authenticated,
  onAuthenticationChange,
}: {
  homepage?: boolean;
  authenticated?: boolean;
  onAuthenticationChange?: (signedIn: boolean) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const initial =
    params.get("stage") ??
    { pre: "presentations", live: "voting", post: "closed" }[
      params.get("phase") ?? ""
    ] ??
    "voting";
  const [phase, setPhase] = useState<CodeAndTellPhase | "results">(
    ["presentations", "voting", "closed", "results"].includes(initial)
      ? (initial as CodeAndTellPhase | "results")
      : "voting",
  );
  const [typography, setTypography] = useState(() => {
    const value = params.get("type");
    return [
      "inter",
      "space",
      "plex",
      "original",
      "chivo",
      "overpass",
      "geologica",
    ].includes(value ?? "")
      ? value!
      : "plex";
  });
  const [previewSignedIn, setPreviewSignedIn] = useState(
    params.get("signedIn") !== "0",
  );
  const signedIn = authenticated ?? previewSignedIn;
  const setSignedIn = onAuthenticationChange ?? setPreviewSignedIn;
  const [ballot, setBallot] = useState<Id<"teams">[]>(() =>
    (homepage && params.get("ballot") !== "filled") ||
    params.get("projects") === "empty" ||
    params.get("ballot") === "empty"
      ? []
      : sampleProjects.slice(0, 5).map((project) => project._id),
  );
  const [empty, setEmpty] = useState(params.get("projects") === "empty");
  const fixture = getStagePreview(
    new URLSearchParams({ mode: "code_and_tell", phase: "live" }),
  );
  const projects = empty ? [] : sampleProjects;
  const event = {
    name: "Code & Tell",
    description: "Share what you’re building.",
    startDate: fixture.events[0].startDate,
    endDate: fixture.events[0].endDate,
    codeAndTellPhase: phase === "results" ? ("closed" as const) : phase,
    status: phase === "voting" ? ("active" as const) : ("upcoming" as const),
    resultsReleased: phase === "results",
    teams: projects,
  };
  const context: VotingContext = {
    myEmail: "preview@example.com",
    ownProjectIds: projects
      .filter((project) => project.isOwned)
      .map((project) => project._id),
    requiredRankCount: Math.min(
      5,
      projects.filter((project) => project.isEligible).length,
    ),
    eligibleProjectCount: projects.filter((project) => project.isEligible)
      .length,
    currentBallotTeamIds: ballot,
    maxBallots: null,
    rankedVoteRowCount: ballot.length ? 1 : 0,
    hasSubmittedBallot: !!ballot.length,
    votingClosedToNewVoters: false,
    projects,
  };
  return (
    <div
      className={`ct-type-preview${homepage ? " hp-event-preview" : ""}`}
      data-typography={homepage ? "plex" : typography}
    >
      <nav className="ct-preview-controls" aria-label="Preview controls">
        <strong>Design preview</strong>
        <span>Sample data · changes stay in this page</span>
        <label>
          Stage{" "}
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as typeof phase)}
          >
            {["presentations", "voting", "closed", "results"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={signedIn}
            onChange={(e) => setSignedIn(e.target.checked)}
          />{" "}
          Signed in
        </label>
        {phase === "closed" && (
          <label>
            <input
              type="checkbox"
              checked={ballot.length > 0}
              onChange={(e) =>
                setBallot(
                  e.target.checked
                    ? sampleProjects
                        .filter((project) => project.isEligible)
                        .slice(0, 5)
                        .map((project) => project._id)
                    : [],
                )
              }
            />{" "}
            Submitted ballot
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={empty}
            onChange={(e) => {
              setEmpty(e.target.checked);
              setBallot([]);
            }}
          />{" "}
          No projects
        </label>
      </nav>
      {!homepage && (
        <div
          className="ct-type-choices"
          role="group"
          aria-label="Typography variations"
        >
          <span>Typography</span>
          {[
            ["chivo", "Chivo", "Sturdy & expressive"],
            ["overpass", "Overpass", "Clear & utilitarian"],
            ["geologica", "Geologica", "Geometric & characterful"],
            ["plex", "IBM Plex Sans", "Your current favorite"],
          ].map(([value, name, description]) => (
            <button
              key={value}
              aria-pressed={typography === value}
              onClick={() => {
                setTypography(value);
                const url = new URL(window.location.href);
                url.searchParams.set("type", value);
                window.history.replaceState(null, "", url);
              }}
            >
              <strong>{name}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
      )}
      <ParticipationFrame mode="code_and_tell">
        <CodeAndTellWorkspace
          key={phase}
          event={event}
          onBack={() => {
            if (homepage)
              document
                .getElementById("events")
                ?.scrollIntoView({ behavior: "smooth" });
            else window.location.href = "/?demo=1&mode=hackathon";
          }}
        >
          <CodeAndTellBallotView
            eventId={"preview-event" as Id<"events">}
            event={event}
            onBack={() => setPhase("presentations")}
            loggedInUser={
              signedIn ? { _id: "preview", email: "preview@example.com" } : null
            }
            onPreviewSignIn={() => setSignedIn(true)}
            submittedBallot={ballot}
            votingContext={context}
            saveBallot={async (values) => setBallot(values.rankedTeamIds)}
            publicResults={{
              winnerTeamId: projects[0]?._id ?? null,
              totalBallots: projects.length ? 12 : 0,
              standings: projects.map((project, index) => {
                const rankCounts = [
                  [6, 2, 1, 1, 0],
                  [3, 4, 2, 1, 0],
                  [1, 3, 4, 1, 1],
                  [1, 1, 3, 4, 1],
                  [1, 1, 1, 3, 4],
                  [0, 1, 1, 2, 6],
                  [0, 0, 0, 0, 0],
                ][index];
                return {
                  teamId: project._id,
                  name: project.name,
                  description: project.description,
                  points: rankCounts.reduce(
                    (total, count, rank) => total + count * (5 - rank),
                    0,
                  ),
                  ballotsCount: rankCounts.reduce(
                    (total, count) => total + count,
                    0,
                  ),
                  rankCounts,
                };
              }),
            }}
          />
        </CodeAndTellWorkspace>
      </ParticipationFrame>
    </div>
  );
}

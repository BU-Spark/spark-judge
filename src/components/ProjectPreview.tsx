import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { TeamPageView } from "./TeamPage";
import { getEventMode } from "../lib/eventModes";
import { PrizeEntryPicker } from "./ui/PrizeEntryPicker";
import {
  isAutomaticPrize,
  isPrizeEligibleForTrack,
  type EntryPrize,
} from "../../shared/prizeEntries";
import { HeartIcon } from "./participation/ParticipationChrome";

const samplePrizes: (EntryPrize & { name: string; sponsorName?: string })[] = [
  {
    _id: "preview-first-hack",
    eventId: "preview-event",
    name: "First Hack",
    type: "general",
    entryMode: "opt_in",
  },
  {
    _id: "preview-environment",
    eventId: "preview-event",
    name: "Env",
    type: "track",
    track: "Environment",
    entryMode: "automatic",
  },
  {
    _id: "preview-sponsor",
    eventId: "preview-event",
    name: "Best use of sponsor tools",
    sponsorName: "Example sponsor",
    type: "sponsor",
    entryMode: "opt_in",
  },
];

export function ProjectPreview() {
  const [params] = useSearchParams();
  const mode = getEventMode(params.get("mode"));
  const [count, setCount] = useState(2);
  const demoDay = mode === "demo_day";
  const [selectedPrizeIds, setSelectedPrizeIds] = useState([
    "preview-first-hack",
  ]);
  return (
    <>
      <p className="platform-preview-note">
        Project preview · Sample data only
      </p>
      {mode === "hackathon" && (
        <details className="platform-preview-controls">
          <summary>Try prize selection · Preview only</summary>
          <PrizeEntryPicker
            prizes={samplePrizes}
            track="Environment"
            selectedPrizeIds={selectedPrizeIds}
            onSelectionChange={setSelectedPrizeIds}
          />
        </details>
      )}
      <TeamPageView
        event={{
          name: demoDay
            ? "Fall Demo Day"
            : mode === "code_and_tell"
              ? "Code & Tell"
              : "CivicHacks 2026",
          mode,
          status: "active",
        }}
        team={{
          eventId: "preview-event" as Id<"events">,
          name: "AgriSense",
          description:
            "Making sense of soil, one garden at a time.\n\nAgriSense helps community gardeners understand when to water, what to plant, and how their soil changes through the season. A small sensor collects moisture and temperature readings, and a simple dashboard turns them into a daily plan.\n\nBuilt with local gardens, the project brings practical growing advice to people sharing a small patch of the city.",
          members: ["Jordan Lee", "Taylor Brooks"],
          courseCode: demoDay ? "CS 506" : undefined,
          track: mode === "hackathon" ? "Environment" : undefined,
          prizeEntries:
            mode === "hackathon"
              ? samplePrizes
                  .filter(
                    (prize) =>
                      isPrizeEligibleForTrack(prize, "Environment") &&
                      (isAutomaticPrize(prize) ||
                        selectedPrizeIds.includes(prize._id)),
                  )
                  .map((prize) => ({
                    _id: prize._id as Id<"prizes">,
                    name: prize.name,
                    automatic: isAutomaticPrize(prize),
                  }))
              : [],
          githubUrl: "https://github.com",
          projectUrl: "https://example.com",
        }}
        eventHref={`/participation-preview?mode=${mode}`}
        appreciationCount={demoDay ? 28 + count - 2 : undefined}
        activity={
          demoDay ? (
            <div className="project-appreciation">
              <h2>Show your appreciation</h2>
              <p>
                {100 - count} left to share across the event. Up to 10 per
                project.
              </p>
              <button
                onClick={() => setCount((value) => value + 1)}
                disabled={count >= 10}
              >
                <HeartIcon />
                {count >= 10 ? "Project limit reached" : "Give appreciation"}
              </button>
              <p className="project-appreciation-progress" aria-live="polite">
                {count} / 10 given to this project
              </p>
            </div>
          ) : undefined
        }
      />
    </>
  );
}

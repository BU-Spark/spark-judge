import { type ReactNode } from "react";
import {
  codeAndTellPhase,
  type CodeAndTellPhase,
} from "../../../convex/codeAndTellPhase";
import { DirectionIcon } from "../participation/ParticipationChrome";
import "./workspace.css";

export type WorkspaceEvent = {
  name: string;
  description: string;
  startDate: number;
  status: "upcoming" | "active" | "past";
  codeAndTellPhase?: CodeAndTellPhase;
  resultsReleased?: boolean;
  teams: {
    _id: string;
    name: string;
    description: string;
    members?: string[];
  }[];
};
const phaseLabels = {
  submissions: "Voting hasn’t opened yet",
  presentations: "Presentations",
  voting: "Voting open",
  closed: "Voting closed",
};

export function CodeAndTellWorkspace({
  event,
  onBack,
  children,
}: {
  event: WorkspaceEvent;
  onBack: () => void;
  children?: ReactNode;
}) {
  const phase = codeAndTellPhase(event);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(event.startDate);
  return (
    <div className="ct-workspace">
      <div className="ct-topline">
        <button onClick={onBack}>
          All events <DirectionIcon direction="left" />
        </button>
        <span>
          {date}
          <span className="ct-dot" />
          {event.resultsReleased ? "Results released" : phaseLabels[phase]}
        </span>
      </div>
      <header className="ct-masthead">
        <h1>{event.name}</h1>
        <span className="ct-mark" aria-hidden="true">
          &
        </span>
      </header>
      {children}
      <footer className="ct-footer">
        <span>Code &amp; Tell / HackJudge</span>
        <span>
          {phase === "submissions"
            ? "A place for projects and the people behind them."
            : phase === "voting"
              ? "Your favorite goes first."
              : "Projects and the people behind them."}
        </span>
      </footer>
    </div>
  );
}

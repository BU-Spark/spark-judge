import { type ReactNode } from "react";
import {
  codeAndTellPhase,
  type CodeAndTellPhase,
} from "../../../convex/codeAndTellPhase";
import { DirectionIcon } from "../participation/ParticipationChrome";
import { CODE_AND_TELL_TITLE, CODE_AND_TELL_SUBTITLE } from "../../lib/codeAndTellPresentation";
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
  submissions: "Voting soon",
  presentations: "Voting soon",
  voting: "Voting open",
  closed: "Voting closed",
};

export function CodeAndTellWorkspace({
  event,
  onBack,
  contextLabel,
  children,
}: {
  event: WorkspaceEvent;
  onBack: () => void;
  contextLabel?: string;
  children?: ReactNode;
}) {
  const phase = codeAndTellPhase(event);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(event.startDate);
  return (
    <div className="ct-workspace">
      {contextLabel && <div className="ct-card-edge" aria-hidden="true" />}
      <div className="ct-topline">
        {contextLabel ? (
          <span className="ct-context-label">{contextLabel}</span>
        ) : (
          <button onClick={onBack}>
            All events <DirectionIcon direction="left" />
          </button>
        )}
        <span>
          {date}
          <span className="ct-dot" />
          {event.resultsReleased ? "Results available" : phaseLabels[phase]}
        </span>
      </div>
      <header className="ct-masthead ct-series-masthead">
        <h1>{CODE_AND_TELL_TITLE}</h1>
        <p className="ct-series-subtitle">{CODE_AND_TELL_SUBTITLE}</p>
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

import type { ReactNode } from "react";
import type { EventMode } from "../../lib/eventModes";
import "../home/event-stage.css";
import "./participation.css";

export function ParticipationFrame({
  mode,
  children,
}: {
  mode: EventMode;
  children: ReactNode;
}) {
  return (
    <div className={`participation participation--${mode}`}>{children}</div>
  );
}

export function ParticipationHeader({
  title,
  description,
  onBack,
  aside,
}: {
  title: string;
  description: string;
  onBack: () => void;
  aside?: ReactNode;
}) {
  return (
    <header className="participation-header">
      <button className="participation-back" onClick={onBack}>
        <DirectionIcon direction="left" /> Back to events
      </button>
      <div className="participation-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {aside}
      </div>
    </header>
  );
}

export function DirectionIcon({
  direction = "right",
}: {
  direction?: "left" | "right" | "up" | "down";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      style={{
        transform: `rotate(${{ right: 0, down: 90, left: 180, up: 270 }[direction]}deg)`,
      }}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M20.3 4.7a5.5 5.5 0 0 0-7.8 0L12 5.2l-.5-.5a5.5 5.5 0 0 0-7.8 7.8L12 21l8.3-8.5a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

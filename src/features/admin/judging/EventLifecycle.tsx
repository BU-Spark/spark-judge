import type { ReactNode } from "react";

export type LifecycleStep = { id: string; label: string };

/**
 * The event's position in its lifecycle plus the single next thing to do.
 * Steps are format-specific; the presentation is shared.
 */
export function EventLifecycle({
  steps,
  currentId,
  nextAction,
}: {
  steps: LifecycleStep[];
  currentId: string;
  nextAction?: ReactNode;
}) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId),
  );
  return (
    <section className="admin-lifecycle" aria-label="Event progress">
      <ol>
        {steps.map((step, index) => {
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          return (
            <li
              key={step.id}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span aria-hidden="true" className="admin-lifecycle-dot" />
              <span>
                {step.label}
                {state === "done" && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {nextAction && <div className="admin-lifecycle-next">{nextAction}</div>}
    </section>
  );
}

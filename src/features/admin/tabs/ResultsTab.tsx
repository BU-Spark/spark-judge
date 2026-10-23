import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  getResultReadiness,
  type ResultsInput,
} from "../../../../shared/resultReadiness";
import { InlineFailure } from "../../../components/ui/TaskStatus";
import {
  toRecoverableFailure,
  type OperationResult,
  type RecoverableFailure,
} from "../../../lib/operationOutcome";

export function ResultsTab({
  input,
  eventName,
  publicUrl,
  published,
  hidden,
  loading,
  editing,
  editor,
  onEdit,
  onScores,
  onPrizes,
  onTeams,
  onFinish,
  onLock,
  locking,
  onPublish,
  onWithdraw,
}: {
  input: ResultsInput;
  eventName: string;
  publicUrl: string;
  published: boolean;
  hidden?: boolean;
  loading?: boolean;
  editing: boolean;
  editor: ReactNode;
  onEdit: () => void;
  onScores: () => void;
  onPrizes: () => void;
  onTeams?: () => void;
  onFinish: () => Promise<void>;
  /** Resolves with a failure instead of throwing. */
  onLock: () => Promise<OperationResult>;
  locking: boolean;
  onPublish: () => Promise<unknown>;
  onWithdraw: () => Promise<unknown>;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [lockFailure, setLockFailure] = useState<RecoverableFailure | null>(
    null,
  );
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const previous = useRef({ editing, published });
  const readiness = getResultReadiness(input);
  const isHackathon = (input.mode ?? "hackathon") === "hackathon";
  const savedResults =
    published &&
    isHackathon &&
    readiness.awards.length === 0 &&
    (input.overallWinnerId || input.categoryWinners.length > 0)
      ? getResultReadiness({ ...input, mode: "demo_day" })
      : readiness;
  const canEdit =
    !published &&
    !loading &&
    input.teams.some((team) => !team.hidden) &&
    (isHackathon
      ? input.scoringLocked && readiness.awards.length > 0
      : input.mode !== "code_and_tell" || input.status === "past");

  useEffect(() => {
    if (reviewing || correcting) reviewHeading.current?.focus();
  }, [reviewing, correcting]);

  useEffect(() => {
    if (
      (previous.current.editing && !editing) ||
      previous.current.published !== published
    ) {
      title.current?.focus();
      title.current?.scrollIntoView?.({ block: "start" });
    }
    previous.current = { editing, published };
  }, [editing, published]);

  const perform = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
      setReviewing(false);
      setCorrecting(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save this change. Try again.",
      );
    } finally {
      setPending(false);
    }
  };

  const lockScoring = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    setLockFailure(null);
    try {
      const result = await onLock();
      if (!result.ok) setLockFailure(result.failure);
    } catch (failure) {
      setLockFailure(toRecoverableFailure(failure, "lock scoring"));
    } finally {
      setPending(false);
    }
  };

  if (loading)
    return (
      <div className="admin-results" role="status">
        Loading saved results…
      </div>
    );
  if (editing && canEdit) return <div className="admin-results">{editor}</div>;

  return (
    <section
      className="admin-results"
      aria-labelledby="results-title"
      aria-busy={pending}
    >
      <header className="admin-results-heading">
        <div>
          <h2 id="results-title" ref={title} tabIndex={-1}>
            Results
          </h2>
          <p>
            {published
              ? "Published results are available on the event page."
              : "Choose winners, review your selections, then publish."}
          </p>
        </div>
        <span className="admin-result-status">
          {published
            ? "Published"
            : readiness.ready
              ? "Ready to publish"
              : "Draft"}
        </span>
      </header>

      {error && (
        <p className="admin-result-error" role="alert">
          {error}
        </p>
      )}
      {lockFailure && !input.scoringLocked && (
        <InlineFailure
          failure={lockFailure}
          title="Scoring is still unlocked"
          onRetry={() => void lockScoring()}
          busy={pending || locking}
          onDismiss={() => setLockFailure(null)}
        />
      )}
      {hidden && (
        <p className="admin-result-notice">
          This event is hidden. Publishing results keeps the event visible to
          admins only.
        </p>
      )}

      {published ? (
        <div className="admin-results-actions">
          <Link className="fi-transport" to={publicUrl}>
            View published results
          </Link>
          <button
            className="fi-key"
            onClick={() => setCorrecting(true)}
            disabled={pending}
          >
            Correct results
          </button>
        </div>
      ) : (
        !reviewing && (
          <div className="admin-results-preparation">
            <div>
              <h3>
                {readiness.ready
                  ? "Your results are ready for review"
                  : "Before you publish"}
              </h3>
              {readiness.blockers.length > 0 ? (
                <ul>
                  {readiness.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  All required winners are saved. Review what participants will
                  see.
                </p>
              )}
            </div>
            <div className="admin-results-actions">
              {!input.teams.some((team) => !team.hidden) && onTeams && (
                <button className="fi-key" onClick={onTeams}>
                  Add projects
                </button>
              )}
              {input.status === "active" && (
                <button
                  className="fi-key"
                  onClick={() => void perform(onFinish)}
                  disabled={pending}
                >
                  Finish event
                </button>
              )}
              {input.status === "upcoming" && (
                <p>The event has not started yet.</p>
              )}
              {isHackathon && !input.scoringLocked && (
                <button
                  className="fi-key"
                  onClick={() => void lockScoring()}
                  disabled={pending || locking}
                >
                  {locking ? "Locking…" : "Lock scoring"}
                </button>
              )}
              {isHackathon && readiness.awards.length === 0 && (
                <button className="fi-key" onClick={onPrizes}>
                  Configure prizes
                </button>
              )}
              <button
                className={readiness.ready ? "fi-key" : "fi-transport"}
                onClick={onEdit}
                disabled={!canEdit || pending}
              >
                {readiness.selectedCount ? "Edit winners" : "Choose winners"}
              </button>
              {readiness.ready && (
                <button
                  className="fi-transport"
                  onClick={() => {
                    setError("");
                    setReviewing(true);
                  }}
                >
                  Review and publish
                </button>
              )}
            </div>
          </div>
        )
      )}

      {correcting && (
        <section
          className="admin-results-review"
          aria-labelledby="correct-results-title"
        >
          <h3 id="correct-results-title" ref={reviewHeading} tabIndex={-1}>
            Withdraw results to make corrections?
          </h3>
          <p>
            Results will be removed from the event page. Your saved selections
            stay available to edit and publish again.
          </p>
          {!readiness.ready && (
            <p>Before republishing: {readiness.blockers.join(" ")}</p>
          )}
          <div className="admin-results-actions">
            <button
              className="fi-transport"
              disabled={pending}
              onClick={() => void perform(onWithdraw)}
            >
              {pending ? "Withdrawing…" : "Withdraw results"}
            </button>
            <button
              className="fi-key"
              disabled={pending}
              onClick={() => setCorrecting(false)}
            >
              Keep published
            </button>
          </div>
        </section>
      )}

      {reviewing && (
        <div className="admin-results-review">
          <h3 ref={reviewHeading} tabIndex={-1}>
            Review results for {eventName}
          </h3>
          <p>
            These saved winners will appear on the event page when you publish.
            Saving winner selections alone does not publish them.
          </p>
          {readiness.optionalUnassigned.length > 0 && (
            <p>
              Optional categories without awards:{" "}
              {readiness.optionalUnassigned
                .map((award) => award.name)
                .join(", ")}
              .
            </p>
          )}
          {!readiness.ready && (
            <p role="alert">
              The event changed while you were reviewing.{" "}
              {readiness.blockers.join(" ")}
            </p>
          )}
        </div>
      )}

      <div className="admin-results-awards">
        <div className="admin-results-awards-heading">
          <h3>{reviewing ? "Winners to publish" : "Saved winners"}</h3>
          {savedResults.awards.length > 0 && (
            <span>
              {savedResults.selectedCount} of {savedResults.awards.length}{" "}
              selected
            </span>
          )}
        </div>
        {savedResults.awards.length === 0 ? (
          <p>No prize awards are configured for this event.</p>
        ) : (
          <dl>
            {savedResults.awards.map((award) => (
              <div className="admin-award-row" key={award.id}>
                <dt>
                  {award.name}
                  {!award.required && <span>Optional</span>}
                </dt>
                <dd>
                  {award.team?.name ??
                    (award.required ? "Winner needed" : "No award selected")}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <footer className="admin-results-actions">
        {reviewing ? (
          <>
            <button
              className="fi-transport"
              disabled={pending || !readiness.ready}
              onClick={() => void perform(onPublish)}
            >
              {pending ? "Publishing…" : "Publish results"}
            </button>
            <button
              className="fi-key"
              disabled={pending}
              onClick={() => setReviewing(false)}
            >
              Back to results
            </button>
          </>
        ) : (
          <button className="fi-key" onClick={onScores}>
            Review scores
          </button>
        )}
      </footer>
    </section>
  );
}

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  codeAndTellPhase,
  type CodeAndTellPhase,
} from "../../../../convex/codeAndTellPhase";

export function CodeAndTellStageControl({
  eventId,
}: {
  eventId: Id<"events">;
}) {
  const event = useQuery(api.events.getEvent, { eventId });
  const setPhase = useMutation(api.codeAndTell.setPhase);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!event || event.mode !== "code_and_tell") return null;
  return (
    <section className="fi-panel p-4">
      <label className="font-semibold">
        Participant stage{" "}
        <select
          className="ml-3 p-2 border rounded"
          aria-label="Participant stage"
          disabled={pending || event.resultsReleased}
          value={codeAndTellPhase(event)}
          onChange={async (e) => {
            const phase = e.target.value as CodeAndTellPhase;
            setPending(true);
            setError("");
            try {
              await setPhase({ eventId, phase });
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not change stage",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <option value="submissions">Submissions open</option>
          <option value="presentations">
            Presentations · submissions closed
          </option>
          <option value="voting">Voting open</option>
          <option value="closed">Voting closed · results pending</option>
        </select>
      </label>
      <p className="text-sm mt-2">
        You control these stages. Dates won’t advance them after you choose a
        stage. Close voting before confirming the winner and releasing results.
      </p>
      {error && (
        <p role="alert" className="text-red-700 mt-2">
          {error}
        </p>
      )}
    </section>
  );
}

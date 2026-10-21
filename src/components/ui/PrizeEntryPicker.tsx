import { useId, useState } from "react";
import {
  isAutomaticPrize,
  isPrizeEligibleForTrack,
  type EntryPrize,
} from "../../../shared/prizeEntries";
import "./prize-entry-picker.css";

type PrizeOption = EntryPrize & { name: string; sponsorName?: string };
export function PrizeEntryPicker({
  prizes,
  track,
  selectedPrizeIds,
  onSelectionChange,
  disabled = false,
}: {
  prizes: PrizeOption[] | undefined;
  track: string;
  selectedPrizeIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [sponsor, setSponsor] = useState("");
  const eligible = (prizes ?? []).filter((prize) =>
    isPrizeEligibleForTrack(prize, track),
  );
  const automatic = eligible.filter(isAutomaticPrize);
  const optional = eligible.filter((prize) => !isAutomaticPrize(prize));
  const sponsors = [
    ...new Set(
      optional
        .map((prize) => prize.sponsorName?.trim())
        .filter((value): value is string => !!value),
    ),
  ].sort();
  const visible = optional.filter(
    (prize) => !sponsor || prize.sponsorName?.trim() === sponsor,
  );
  const selectedCount = optional.filter((prize) =>
    selectedPrizeIds.includes(prize._id),
  ).length;
  return (
    <fieldset
      className="prize-entry-picker"
      disabled={disabled}
      aria-describedby={`${id}-help`}
    >
      <legend>Prize entries</legend>
      <p id={`${id}-help`}>
        Automatic entries are included with your track. Choose any additional
        prizes below; you can select more than one.
      </p>
      {automatic.length > 0 && (
        <div
          className="prize-entry-automatic"
          role="group"
          aria-label="Automatic prize entries"
        >
          <h3>Automatic entries</h3>
          {automatic.map((prize) => (
            <label key={prize._id} className="prize-entry-option">
              <input type="checkbox" checked disabled />
              <span>
                <strong>{prize.name}</strong>
                <small>Entered automatically with {track}</small>
              </span>
            </label>
          ))}
        </div>
      )}
      {optional.length > 0 && (
        <>
          <div className="prize-entry-heading">
            <h3>Additional prize entries</h3>
            <span aria-live="polite">{selectedCount} selected</span>
          </div>
          <label className="prize-entry-sponsor" htmlFor={`${id}-sponsor`}>
            Filter by sponsor
            <select
              id={`${id}-sponsor`}
              value={sponsor}
              onChange={(event) => setSponsor(event.target.value)}
            >
              <option value="">All sponsors</option>
              {sponsors.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {prizes === undefined ? (
        <p role="status">Loading prizes…</p>
      ) : eligible.length === 0 ? (
        <p>
          {prizes.length > 0
            ? "Choose a track to see its eligible prizes."
            : "No prizes are configured for this event."}
        </p>
      ) : optional.length === 0 ? (
        <p>No additional prize entries are available for this track.</p>
      ) : visible.length === 0 ? (
        <p>No prizes match this sponsor filter.</p>
      ) : null}
      <div className="prize-entry-options">
        {visible.map((prize) => (
          <label key={prize._id} className="prize-entry-option">
            <input
              type="checkbox"
              checked={selectedPrizeIds.includes(prize._id)}
              onChange={(event) =>
                onSelectionChange(
                  event.target.checked
                    ? [...new Set([...selectedPrizeIds, prize._id])]
                    : selectedPrizeIds.filter((value) => value !== prize._id),
                )
              }
            />
            <span>
              <strong>{prize.name}</strong>
              <small>
                {prize.sponsorName
                  ? `Sponsor: ${prize.sponsorName}`
                  : prize.track
                    ? `Track: ${prize.track}`
                    : "General prize"}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p className="prize-entry-note">
        Automatic entries follow your track. Additional entries are saved with
        your submission.
      </p>
    </fieldset>
  );
}

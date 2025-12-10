export type EventStatus = "upcoming" | "active" | "past";

type Params = {
  startDate: number;
  endDate: number;
  status?: EventStatus;
  now?: number;
};

/**
 * Derive display status for an event.
 * - If the stored status is "past", always return "past" (manual close).
 * - Otherwise, compute based on start/end vs current time.
 */
export function computeEventDisplayStatus({
  startDate,
  endDate,
  status,
  now = Date.now(),
}: Params): EventStatus {
  if (status === "past") return "past";
  if (now < startDate) return "upcoming";
  if (now > endDate) return "past";
  return "active";
}


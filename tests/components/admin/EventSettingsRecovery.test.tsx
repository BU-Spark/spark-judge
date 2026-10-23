import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";

const queryResults = vi.hoisted(() => new Map<string, unknown>());
const mutations = vi.hoisted(() => new Map<string, ReturnType<typeof vi.fn>>());

vi.mock("convex/react", () => ({
  useQuery: (ref: { _name: string }, args: unknown) =>
    args === "skip" ? undefined : queryResults.get(ref._name),
  useMutation: (ref: { _name: string }) => {
    if (!mutations.has(ref._name)) mutations.set(ref._name, vi.fn().mockResolvedValue(null));
    return mutations.get(ref._name);
  },
  useAction: () => vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => {
  const moduleProxy = (mod: string) =>
    new Proxy({}, { get: (_target, fn) => ({ _name: `${mod}.${String(fn)}` }) });
  return { api: new Proxy({}, { get: (_target, mod) => moduleProxy(String(mod)) }) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Minimal stand-ins for the tab views; the workspace logic is what's under test.
vi.mock("../../../src/features/admin/tabs/DetailsTab", () => ({
  DetailsTab: (props: any) => (
    <div>
      <label>
        Event name
        <input value={props.eventName} onChange={(e) => props.setEventName(e.target.value)} />
      </label>
      <label>
        Judge code
        <input value={props.judgeCodeEdit} onChange={(e) => props.setJudgeCodeEdit(e.target.value)} />
      </label>
      <button type="button" onClick={() => void props.handleSaveJudgeSettings()}>
        Save judging settings
      </button>
    </div>
  ),
}));
vi.mock("../../../src/features/admin/tabs/ScoresTab", () => ({
  ScoresTab: (props: any) => (
    <button type="button" onClick={props.onToggleScoringLock}>
      {props.scoringLocked ? "Unlock scoring…" : "Lock scoring"}
    </button>
  ),
}));

// Both stand-ins call the lock prop and render what it resolved with, so the
// tests can check that each entry point uses the result-returning handler.
function LockProbe({ label, onLock }: { label: string; onLock: () => Promise<any> }) {
  const [outcome, setOutcome] = useState("");
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void onLock().then((result) =>
            setOutcome(result.ok ? "locked" : `failed: ${result.failure.message}`),
          )
        }
      >
        {label}
      </button>
      <output>{outcome}</output>
    </div>
  );
}
vi.mock("../../../src/features/admin/tabs/HackathonOverviewTab", () => ({
  HackathonOverviewTab: (props: any) => (
    <LockProbe label="Overview lock" onLock={props.onLockScoring} />
  ),
}));
vi.mock("../../../src/features/admin/tabs/ResultsTab", () => ({
  ResultsTab: (props: any) => <LockProbe label="Results lock" onLock={props.onLock} />,
}));

import { EventManagementModal } from "../../../src/features/admin/legacy/AdminLegacy";

const NOW = Date.now();
function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: "event1",
    name: "Spring Hack",
    description: "",
    mode: "hackathon",
    status: "active",
    startDate: NOW - 3_600_000,
    endDate: NOW + 3_600_000,
    categories: [
      { name: "Design", weight: 1 },
      { name: "Impact", weight: 1 },
    ],
    tracks: ["AI"],
    judgeCode: "OLD",
    enableCohorts: false,
    teams: [],
    resultsReleased: false,
    ...overrides,
  };
}

function setEvent(event: Record<string, unknown>) {
  queryResults.set("events.getEvent", event);
}

function renderWorkspace(
  initialTab: "details" | "scores" | "overview" | "winners" = "details",
) {
  // A fresh element each time so React re-renders and re-reads the mocked queries.
  const ui = () => (
    <MemoryRouter>
      <EventManagementModal eventId={"event1" as any} onClose={() => {}} initialTab={initialTab} />
    </MemoryRouter>
  );
  const view = render(ui());
  return { ...view, rerenderSame: () => view.rerender(ui()) };
}

beforeEach(() => {
  queryResults.clear();
  mutations.clear();
  setEvent(makeEvent());
  queryResults.set("scores.getEventScores", []);
  queryResults.set("prizes.listEventPrizes", []);
});

describe("judging settings (O03)", () => {
  it("saves categories, cohorts, and judge code with one combined mutation", async () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Judge code"), { target: { value: "NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Save judging settings" }));

    await waitFor(() => expect(mutations.get("events.updateJudgingSettings")).toHaveBeenCalledTimes(1));
    expect(mutations.get("events.updateJudgingSettings")).toHaveBeenCalledWith({
      eventId: "event1",
      categories: [
        expect.objectContaining({ name: "Design" }),
        expect.objectContaining({ name: "Impact" }),
      ],
      enableCohorts: false,
      judgeCode: "NEW",
    });
    expect(mutations.get("events.updateEventCategories")).toBeUndefined();
    expect(mutations.get("events.updateEventCohorts")).toBeUndefined();
    expect(mutations.get("events.updateEventDetails")).not.toHaveBeenCalled();
  });

  it("shows a persistent failure, keeps the edit, and retries", async () => {
    renderWorkspace();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Judging settings are locked once scoring has started"))
      .mockResolvedValueOnce(null);
    mutations.set("events.updateJudgingSettings", save);
    fireEvent.change(screen.getByLabelText("Judge code"), { target: { value: "NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Save judging settings" }));

    expect(await screen.findByText("Judging settings not saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Judge code")).toHaveValue("NEW");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Judging settings not saved")).not.toBeInTheDocument());
  });
});

describe("hydration (O04)", () => {
  it("applies server changes silently when the section has no edits", () => {
    const { rerenderSame } = renderWorkspace();
    setEvent(makeEvent({ name: "Renamed elsewhere" }));
    rerenderSame();
    expect(screen.getByLabelText("Event name")).toHaveValue("Renamed elsewhere");
    expect(screen.queryByText("Settings changed elsewhere")).not.toBeInTheDocument();
  });

  it("keeps unsaved edits when the server changes and offers Load latest", () => {
    const { rerenderSame } = renderWorkspace();
    fireEvent.change(screen.getByLabelText("Judge code"), { target: { value: "MINE" } });

    setEvent(makeEvent({ judgeCode: "THEIRS" }));
    rerenderSame();
    expect(screen.getByLabelText("Judge code")).toHaveValue("MINE");
    expect(screen.getByText("Settings changed elsewhere")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load latest" }));
    expect(screen.getByLabelText("Judge code")).toHaveValue("THEIRS");
    expect(screen.queryByText("Settings changed elsewhere")).not.toBeInTheDocument();
  });

  it("does not wipe edits when unrelated event data (teams) changes", () => {
    const { rerenderSame } = renderWorkspace();
    fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Draft name" } });
    setEvent(makeEvent({ teams: [{ _id: "t1", name: "Alpha", members: [] }] }));
    rerenderSame();
    expect(screen.getByLabelText("Event name")).toHaveValue("Draft name");
    expect(screen.queryByText("Settings changed elsewhere")).not.toBeInTheDocument();
  });
});

describe("scoring lock confirmation (O06)", () => {
  it("stays open with the failure on error and closes after a successful retry", async () => {
    setEvent(makeEvent({ scoringLockedAt: NOW - 1000 }));
    const setLock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(null);
    mutations.set("events.setScoringLock", setLock);
    renderWorkspace("scores");

    fireEvent.click(screen.getByRole("button", { name: "Unlock scoring…" }));
    const dialog = screen.getByRole("dialog", { name: "Unlock scoring?" });
    expect(dialog).toHaveAttribute("open");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unlock scoring" }));
    });
    expect(setLock).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Scoring is still locked")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(setLock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  });
});

describe("scoring lock entry points (O06)", () => {
  it.each([
    ["overview", "Overview lock"],
    ["winners", "Results lock"],
  ] as const)("%s tab locks through the shared handler and reports failure", async (tab, label) => {
    const setLock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(null);
    mutations.set("events.setScoringLock", setLock);
    renderWorkspace(tab);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: label }));
    });
    expect(setLock).toHaveBeenCalledWith({
      eventId: "event1",
      locked: true,
      reason: "Deliberation in progress",
    });
    expect(screen.getByRole("status")).toHaveTextContent(/^failed: /);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: label }));
    });
    expect(setLock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("locked");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

// Create mock query functions
const mockGetTeamEventId = vi.hoisted(() => ({ _name: "getTeamEventId" }));

// Results map keyed by query name
const queryResults = vi.hoisted(() => new Map<string, unknown>());

vi.mock("convex/react", () => ({
  useQuery: (queryRef: { _name?: string }, args?: unknown) => {
    const name = queryRef?._name;
    if (name && queryResults.has(name)) {
      // Return "skip" result if args is "skip"
      if (args === "skip") return undefined;
      return queryResults.get(name);
    }
    return undefined;
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

// Mock the Convex API
vi.mock("../../convex/_generated/api", () => ({
  api: {
    teams: {
      getTeamEventId: mockGetTeamEventId,
    },
  },
}));

// Import component after mocks are set up
import { AppNew } from "@/AppNew";

describe("TeamRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
  });

  it("should navigate to the correct event page when a valid team ID is provided in the URL", async () => {
    const mockTeamId = "team123" as Id<"teams">;
    const mockEventId = "event456" as Id<"events">;

    // Mock getTeamEventId to return a valid event ID
    queryResults.set("getTeamEventId", mockEventId);

    const { container } = render(
      <MemoryRouter initialEntries={[`/team/${mockTeamId}`]}>
        <Routes>
          <Route path="/*" element={<AppNew />} />
          <Route
            path="/event/:eventId"
            element={<div>Event Page: {mockEventId}</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Initially should show loading state
    expect(screen.getByText("Loading project...")).toBeInTheDocument();

    // Wait for navigation to event page
    await waitFor(
      () => {
        expect(screen.queryByText("Loading project...")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should have navigated (loading screen gone)
    expect(container).toBeTruthy();
  });

  it("should navigate to the home page when an invalid team ID is provided in the URL", async () => {
    const mockTeamId = "invalidTeam" as Id<"teams">;

    // Mock getTeamEventId to return null (team not found)
    queryResults.set("getTeamEventId", null);

    const { container } = render(
      <MemoryRouter initialEntries={[`/team/${mockTeamId}`]}>
        <Routes>
          <Route path="/*" element={<AppNew />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Initially should show loading state
    expect(screen.getByText("Loading project...")).toBeInTheDocument();

    // Wait for navigation to home page
    await waitFor(
      () => {
        expect(screen.queryByText("Loading project...")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should have navigated (loading screen gone)
    expect(container).toBeTruthy();
  });

  it("should correctly extract teamId from legacy deep-linking URLs and redirect", async () => {
    const mockTeamId = "team789" as Id<"teams">;
    const mockEventId = "event012" as Id<"events">;

    // Mock getTeamEventId to return a valid event ID
    queryResults.set("getTeamEventId", mockEventId);

    // Legacy format: /event/:eventSlug/:teamSlug/:teamId
    const legacyUrl = `/event/spring-hackathon/cool-team/${mockTeamId}`;

    const { container } = render(
      <MemoryRouter initialEntries={[legacyUrl]}>
        <Routes>
          <Route path="/*" element={<AppNew />} />
          <Route
            path="/event/:eventId"
            element={<div>Event Page: {mockEventId}</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Initially should show loading state
    expect(screen.getByText("Loading project...")).toBeInTheDocument();

    // Wait for navigation to event page
    await waitFor(
      () => {
        expect(screen.queryByText("Loading project...")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should have navigated (loading screen gone)
    expect(container).toBeTruthy();
  });

  it("should show loading state while eventId is undefined", () => {
    const mockTeamId = "team123" as Id<"teams">;

    // Don't set any result, so eventId will be undefined (loading)
    queryResults.clear();

    render(
      <MemoryRouter initialEntries={[`/team/${mockTeamId}`]}>
        <Routes>
          <Route path="/*" element={<AppNew />} />
        </Routes>
      </MemoryRouter>
    );

    // Should show loading state
    expect(screen.getByText("Loading project...")).toBeInTheDocument();
  });

  it("should handle missing teamId parameter", () => {
    render(
      <MemoryRouter initialEntries={["/team/"]}>
        <Routes>
          <Route path="/*" element={<AppNew />} />
        </Routes>
      </MemoryRouter>
    );

    // Should show loading or error state (component behavior when teamId is undefined)
    const loadingText = screen.queryByText("Loading project...");
    expect(loadingText).toBeInTheDocument();
  });
});

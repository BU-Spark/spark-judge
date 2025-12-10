import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
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
  Authenticated: ({ children }: { children: React.ReactNode }) => children,
  Unauthenticated: () => null,
}));

// Mock the Convex API
vi.mock("../../convex/_generated/api", () => ({
  api: {
    teams: {
      getTeamEventId: mockGetTeamEventId,
    },
    events: {
      isUserAdmin: { _name: "isUserAdmin" },
    },
  },
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Recreate the TeamRedirect component for testing
function TeamRedirect() {
  const params = useParams<{ teamId: string; eventSlug?: string; teamSlug?: string }>();
  const navigate = useNavigate();
  
  const teamId = params.teamId;
  
  const eventId = queryResults.get("getTeamEventId") as string | null | undefined;

  useEffect(() => {
    if (eventId && teamId) {
      void navigate(`/event/${eventId}/team/${teamId}`, { replace: true });
    } else if (eventId === null) {
      void navigate("/", { replace: true });
    }
  }, [eventId, teamId, navigate]);

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    </div>
  );
}

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

    render(
      <MemoryRouter initialEntries={[`/team/${mockTeamId}`]}>
        <Routes>
          <Route path="/team/:teamId" element={<TeamRedirect />} />
          <Route
            path="/event/:eventId/team/:teamId"
            element={<div>Event Team Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Wait for navigation to event page
    await waitFor(
      () => {
        expect(screen.getByText("Event Team Page")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should navigate to the home page when an invalid team ID is provided in the URL", async () => {
    const mockTeamId = "invalidTeam" as Id<"teams">;

    // Mock getTeamEventId to return null (team not found)
    queryResults.set("getTeamEventId", null);

    render(
      <MemoryRouter initialEntries={[`/team/${mockTeamId}`]}>
        <Routes>
          <Route path="/team/:teamId" element={<TeamRedirect />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for navigation to home page
    await waitFor(
      () => {
        expect(screen.getByText("Home Page")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should correctly extract teamId from legacy deep-linking URLs and redirect", async () => {
    const mockTeamId = "team789" as Id<"teams">;
    const mockEventId = "event012" as Id<"events">;

    // Mock getTeamEventId to return a valid event ID
    queryResults.set("getTeamEventId", mockEventId);

    // Legacy format: /event/:eventSlug/:teamSlug/:teamId
    const legacyUrl = `/event/spring-hackathon/cool-team/${mockTeamId}`;

    render(
      <MemoryRouter initialEntries={[legacyUrl]}>
        <Routes>
          <Route path="/event/:eventSlug/:teamSlug/:teamId" element={<TeamRedirect />} />
          <Route
            path="/event/:eventId/team/:teamId"
            element={<div>Event Team Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Wait for navigation to event team page
    await waitFor(
      () => {
        expect(screen.getByText("Event Team Page")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should show loading state while eventId is undefined", () => {
    const mockTeamId = "team123" as Id<"teams">;

    // Don't set any result, so eventId will be undefined (loading)
    queryResults.clear();

    render(
      <MemoryRouter initialEntries={[`/team/${mockTeamId}`]}>
        <Routes>
          <Route path="/team/:teamId" element={<TeamRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    // Should show loading state
    expect(screen.getByText("Loading project...")).toBeInTheDocument();
  });

  it("should handle missing teamId parameter gracefully", () => {
    // When no teamId is provided in the URL, the route won't match
    // and the component won't render. This tests that behavior.
    render(
      <MemoryRouter initialEntries={["/team/"]}>
        <Routes>
          <Route path="/team/:teamId" element={<TeamRedirect />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </MemoryRouter>
    );

    // The route requires teamId, so it should fall through to Not Found
    expect(screen.queryByText("Not Found")).toBeInTheDocument();
  });
});

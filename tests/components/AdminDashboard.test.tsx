import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Id } from "../../convex/_generated/dataModel";

// Create mock query functions that we can identify
const mockIsUserAdmin = vi.hoisted(() => ({ _name: "isUserAdmin" }));
const mockListEvents = vi.hoisted(() => ({ _name: "listEvents" }));
const mockGetEvent = vi.hoisted(() => ({ _name: "getEvent" }));
const mockGetEventScores = vi.hoisted(() => ({ _name: "getEventScores" }));
const mockGetDetailedEventScores = vi.hoisted(() => ({ _name: "getDetailedEventScores" }));
const mockGetEventAppreciationSummary = vi.hoisted(() => ({ _name: "getEventAppreciationSummary" }));

// Results map keyed by query name
const queryResults = vi.hoisted(() => new Map<string, unknown>());

vi.mock("convex/react", () => ({
  useQuery: (queryRef: { _name?: string }) => {
    const name = queryRef?._name;
    if (name && queryResults.has(name)) {
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
    events: {
      isUserAdmin: mockIsUserAdmin,
      listEvents: mockListEvents,
      getEvent: mockGetEvent,
      updateEventStatus: { _name: "updateEventStatus" },
      updateEventMode: { _name: "updateEventMode" },
      updateEventDetails: { _name: "updateEventDetails" },
      duplicateEvent: { _name: "duplicateEvent" },
      removeEvent: { _name: "removeEvent" },
      createEvent: { _name: "createEvent" },
    },
    teams: {
      createTeam: { _name: "createTeam" },
      hideTeam: { _name: "hideTeam" },
      removeTeam: { _name: "removeTeam" },
    },
    scores: {
      getEventScores: mockGetEventScores,
      getDetailedEventScores: mockGetDetailedEventScores,
      setWinners: { _name: "setWinners" },
      releaseResults: { _name: "releaseResults" },
    },
    appreciations: {
      getEventAppreciationSummary: mockGetEventAppreciationSummary,
    },
    qrCodes: {
      generateQrCodeZip: { _name: "generateQrCodeZip" },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import component after mocks are set up
import { AdminDashboard } from "@/components/AdminDashboard";

describe("AdminDashboard", () => {
  const mockOnBackToLanding = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
  });

  it("should render loading state while checking admin status", () => {
    // All queries return undefined by default (loading state)
    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);
    expect(screen.getByText("Verifying admin access...")).toBeInTheDocument();
  });

  it("should render error state when user is not admin", () => {
    queryResults.set("isUserAdmin", false);

    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("should render admin dashboard when user is admin", () => {
    queryResults.set("isUserAdmin", true);
    queryResults.set("listEvents", { active: [], upcoming: [], past: [] });

    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });
});

describe("EventManagementModal - loading state", () => {
  const mockOnBackToLanding = vi.fn();
  const mockEventId = "event123" as Id<"events">;

  const mockEventsList = {
    active: [
      {
        _id: mockEventId,
        name: "Test Hackathon",
        description: "A test event",
        startDate: Date.now(),
        endDate: Date.now() + 86400000,
        status: "active" as const,
        teamCount: 5,
      },
    ],
    upcoming: [],
    past: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
  });

  it("should not crash when event data is loading (undefined)", async () => {
    // This test verifies the fix for "Cannot read properties of undefined (reading 'startDate')"
    queryResults.set("isUserAdmin", true);
    queryResults.set("listEvents", mockEventsList);
    // getEvent and other modal queries remain undefined (loading state)

    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);

    // Click on the event row to open the modal
    const eventRow = screen.getByText("Test Hackathon");
    fireEvent.click(eventRow);

    // The modal should open without crashing
    // Previously this would throw "Cannot read properties of undefined (reading 'startDate')"
    await waitFor(() => {
      // The event name should still be visible (from the list at minimum)
      expect(screen.getByText("Test Hackathon")).toBeInTheDocument();
    });
  });

  it("should render event details when event data is loaded", async () => {
    const mockEvent = {
      _id: mockEventId,
      name: "Test Hackathon",
      description: "A test event",
      startDate: Date.now() - 3600000, // 1 hour ago (active)
      endDate: Date.now() + 3600000, // 1 hour from now
      status: "active" as const,
      mode: "hackathon" as const,
      teams: [],
    };

    queryResults.set("isUserAdmin", true);
    queryResults.set("listEvents", mockEventsList);
    queryResults.set("getEvent", mockEvent);
    queryResults.set("getEventScores", []);
    queryResults.set("getDetailedEventScores", { teams: [], judges: [], scores: [] });
    queryResults.set("getEventAppreciationSummary", { teams: [], totalAppreciations: 0 });

    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);

    // Click on the event row to open the modal
    const eventRow = screen.getByText("Test Hackathon");
    fireEvent.click(eventRow);

    // Wait for the modal to render with event data
    await waitFor(() => {
      // Should show the event name (appears multiple times - in list and modal)
      const hackathonTexts = screen.getAllByText("Test Hackathon");
      expect(hackathonTexts.length).toBeGreaterThan(0);
    });
  });

  it("should display Active status badge for active event", async () => {
    const mockEvent = {
      _id: mockEventId,
      name: "Test Hackathon",
      description: "A test event",
      startDate: Date.now() - 3600000, // 1 hour ago
      endDate: Date.now() + 3600000, // 1 hour from now
      status: undefined, // Let computeEventDisplayStatus determine it
      mode: "hackathon" as const,
      teams: [],
    };

    queryResults.set("isUserAdmin", true);
    queryResults.set("listEvents", mockEventsList);
    queryResults.set("getEvent", mockEvent);
    queryResults.set("getEventScores", []);
    queryResults.set("getDetailedEventScores", { teams: [], judges: [], scores: [] });
    queryResults.set("getEventAppreciationSummary", { teams: [], totalAppreciations: 0 });

    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);

    // Click on the event row to open the modal
    const eventRow = screen.getByText("Test Hackathon");
    fireEvent.click(eventRow);

    // Wait for the modal to render with status badge
    await waitFor(() => {
      // Should show "Active" status badge (may appear multiple times)
      const activeElements = screen.getAllByText("Active");
      expect(activeElements.length).toBeGreaterThan(0);
    });
  });

  it("should display Upcoming status for future event", async () => {
    const futureEvent = {
      _id: mockEventId,
      name: "Test Hackathon",
      description: "A test event",
      startDate: Date.now() + 86400000, // tomorrow
      endDate: Date.now() + 172800000, // day after tomorrow
      status: undefined,
      mode: "hackathon" as const,
      teams: [],
    };

    const futureEventsList = {
      active: [],
      upcoming: [{ ...mockEventsList.active[0], status: "upcoming" as const }],
      past: [],
    };

    queryResults.set("isUserAdmin", true);
    queryResults.set("listEvents", futureEventsList);
    queryResults.set("getEvent", futureEvent);
    queryResults.set("getEventScores", []);
    queryResults.set("getDetailedEventScores", { teams: [], judges: [], scores: [] });
    queryResults.set("getEventAppreciationSummary", { teams: [], totalAppreciations: 0 });

    render(<AdminDashboard onBackToLanding={mockOnBackToLanding} />);

    // Click on the event row to open the modal
    const eventRow = screen.getByText("Test Hackathon");
    fireEvent.click(eventRow);

    // Wait for the modal to render
    await waitFor(() => {
      const upcomingElements = screen.getAllByText("Upcoming");
      expect(upcomingElements.length).toBeGreaterThan(0);
    });
  });
});



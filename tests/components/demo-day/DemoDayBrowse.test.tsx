import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Id } from "../../../convex/_generated/dataModel";

// Hoisted mock implementation references
const mockUseAttendeeIdentity = vi.hoisted(() => vi.fn());
const mockUseAppreciation = vi.hoisted(() => vi.fn());
const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn(() => vi.fn()));

vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
  useMutation: () => mockUseMutation(),
}));

vi.mock("@/lib/demoDayIdentity", () => ({
  useAttendeeIdentity: () => mockUseAttendeeIdentity(),
}));

vi.mock("@/lib/demoDayApi", () => ({
  useAppreciation: () => mockUseAppreciation(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import component after mocks are set up
import { DemoDayBrowse } from "@/components/demo-day/DemoDayBrowse";

describe("DemoDayBrowse", () => {
  const mockEventId = "event123" as Id<"events">;
  const mockEvent = {
    name: "Demo Day Fall 2024",
    description: "Annual demo day event",
    startDate: Date.now(),
    endDate: Date.now() + 86400000,
    status: "active",
    teams: [
      {
        _id: "team1" as Id<"teams">,
        name: "Team Alpha",
        description: "An awesome project about AI",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team2" as Id<"teams">,
        name: "Team Beta",
        description: "Web development project",
        courseCode: "DS549",
        hidden: false,
      },
      {
        _id: "team3" as Id<"teams">,
        name: "Hidden Team",
        description: "This should not appear",
        courseCode: "DS519",
        hidden: true,
      },
    ],
  };

  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseAttendeeIdentity.mockReturnValue({
      attendeeId: "attendee123",
      fingerprintKey: "fp123",
      isLoading: false,
      error: null,
    });

    mockUseAppreciation.mockReturnValue({
      appreciate: vi.fn().mockResolvedValue({ success: true }),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
    });

    mockUseQuery.mockReturnValue({
      teams: [
        { teamId: "team1" as Id<"teams">, totalCount: 5, attendeeCount: 1 },
        { teamId: "team2" as Id<"teams">, totalCount: 3, attendeeCount: 0 },
      ],
      attendeeTotalCount: 1,
      attendeeRemainingBudget: 14,
      maxPerAttendee: 15,
      maxPerTeam: 3,
    });
  });

  it("should render event name and description", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Demo Day Fall 2024")).toHaveLength(2);
    expect(screen.getByText("Annual demo day event")).toBeInTheDocument();
  });

  it("should render mobile back button", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/back to events/i)).toBeInTheDocument();
  });

  it("should render back button and call onBack when clicked", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    const backButton = screen.getByText("Back to Events");
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it("should render visible teams but not hidden teams", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.getByText("Team Beta")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Team")).not.toBeInTheDocument();
  });

  it("should render team descriptions", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByText("An awesome project about AI")
    ).toBeInTheDocument();
    expect(screen.getByText("Web development project")).toBeInTheDocument();
  });

  it("should render course code badges", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    // Course codes appear in both filter chips and team cards
    const ds519Elements = screen.getAllByText("DS519");
    const ds549Elements = screen.getAllByText("DS549");
    expect(ds519Elements.length).toBeGreaterThan(0);
    expect(ds549Elements.length).toBeGreaterThan(0);
  });

  it("should render budget indicator", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    // Should show remaining budget
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("/ 15 left")).toBeInTheDocument();
  });

  it("should render search input", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(
      "Search projects by name or description..."
    );
    expect(searchInput).toBeInTheDocument();
  });

  it("should filter teams by search query", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(
      "Search projects by name or description..."
    );
    fireEvent.change(searchInput, { target: { value: "Alpha" } });

    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Team Beta")).not.toBeInTheDocument();
  });

  it("should filter teams by description search", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(
      "Search projects by name or description..."
    );
    fireEvent.change(searchInput, { target: { value: "AI" } });

    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Team Beta")).not.toBeInTheDocument();
  });

  it("should render course filter chips", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("All Courses")).toBeInTheDocument();
    // Course codes should appear as filter chips
    const filterChips = screen.getAllByRole("button");
    const chipTexts = filterChips.map((chip) => chip.textContent);
    expect(chipTexts).toContain("All Courses");
  });

  it("should show loading state when identity is loading", () => {
    mockUseAttendeeIdentity.mockReturnValue({
      attendeeId: null,
      fingerprintKey: null,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Initializing...")).toBeInTheDocument();
  });

  it("should render appreciation buttons", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    const appreciateButtons = screen.getAllByText("+1");
    expect(appreciateButtons.length).toBeGreaterThan(0);
  });

  it("should show per-team appreciation count", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    // Should show "X/3" for each team
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("0/3")).toBeInTheDocument();
  });

  it("should show empty state when no teams match filter", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(
      "Search projects by name or description..."
    );
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByText("No Projects Found")).toBeInTheDocument();
    expect(
      screen.getByText("Try adjusting your search terms")
    ).toBeInTheDocument();
  });

  it("should show project count", () => {
    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={mockOnBack}
        />
      </MemoryRouter>
    );

    // Should show "Showing X projects"
    expect(screen.getByText(/Showing 2 projects/)).toBeInTheDocument();
  });
});

describe("DemoDayBrowse - Team Card interactions", () => {
  const mockEventId = "event123" as Id<"events">;
  const mockEvent = {
    name: "Test Event",
    description: "Test",
    startDate: Date.now(),
    endDate: Date.now() + 86400000,
    status: "active",
    teams: [
      {
        _id: "team1" as Id<"teams">,
        name: "Test Team",
        description: "Test description",
        courseCode: "TEST",
        hidden: false,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAttendeeIdentity.mockReturnValue({
      attendeeId: "attendee123",
      fingerprintKey: "fp123",
      isLoading: false,
      error: null,
    });

    mockUseQuery.mockReturnValue({
      teams: [{ teamId: "team1" as Id<"teams">, totalCount: 5, attendeeCount: 2 }],
      attendeeTotalCount: 2,
      attendeeRemainingBudget: 13,
    });
  });

  it("should call appreciate when button is clicked", async () => {
    const mockAppreciateFunc = vi.fn().mockResolvedValue({ success: true });
    mockUseAppreciation.mockReturnValue({
      appreciate: mockAppreciateFunc,
      isLoading: false,
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={vi.fn()}
        />
      </MemoryRouter>
    );

    const appreciateButton = screen.getByText("+1");
    fireEvent.click(appreciateButton);

    await waitFor(() => {
      expect(mockAppreciateFunc).toHaveBeenCalled();
    });
  });

  it("should disable button when max appreciations reached for team", () => {
    mockUseQuery.mockReturnValue({
      teams: [{ teamId: "team1" as Id<"teams">, totalCount: 10, attendeeCount: 3 }],
      attendeeTotalCount: 3,
      attendeeRemainingBudget: 12,
    });

    mockUseAppreciation.mockReturnValue({
      appreciate: vi.fn(),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={vi.fn()}
        />
      </MemoryRouter>
    );

    const maxGivenButton = screen.getByText("Max");
    expect(maxGivenButton).toBeInTheDocument();
    expect(maxGivenButton.closest("button")).toBeDisabled();
  });

  it("should disable button when no budget remaining", () => {
    mockUseQuery.mockReturnValue({
      teams: [{ teamId: "team1" as Id<"teams">, totalCount: 10, attendeeCount: 1 }],
      attendeeTotalCount: 15,
      attendeeRemainingBudget: 0,
    });

    mockUseAppreciation.mockReturnValue({
      appreciate: vi.fn(),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={vi.fn()}
        />
      </MemoryRouter>
    );

    const noBudgetButton = screen.getByText("None Left");
    expect(noBudgetButton).toBeInTheDocument();
    expect(noBudgetButton.closest("button")).toBeDisabled();
  });

  it("should show loading state on button during appreciation", () => {
    mockUseAppreciation.mockReturnValue({
      appreciate: vi.fn(),
      isLoading: true,
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DemoDayBrowse
          eventId={mockEventId}
          event={mockEvent}
          onBack={vi.fn()}
        />
      </MemoryRouter>
    );

    // Should show spinner
    const spinnerContainer = document.querySelector(".animate-spin");
    expect(spinnerContainer).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AdminShell } from "@/features/admin/shell/AdminShell";
import { AdminHomeRoute } from "@/features/admin/routes/AdminHomeRoute";
import { AdminCreateEventRoute } from "@/features/admin/routes/AdminCreateEventRoute";
import { AdminEventRoute } from "@/features/admin/routes/AdminEventRoute";

const mockLoggedInUser = vi.hoisted(() => ({ _name: "loggedInUser" }));
const mockIsUserAdmin = vi.hoisted(() => ({ _name: "isUserAdmin" }));

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

vi.mock("../../convex/_generated/api", () => ({
  api: {
    auth: {
      loggedInUser: mockLoggedInUser,
    },
    events: {
      isUserAdmin: mockIsUserAdmin,
    },
  },
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    auth: {
      loggedInUser: mockLoggedInUser,
    },
    events: {
      isUserAdmin: mockIsUserAdmin,
    },
  },
}));

vi.mock("@/features/admin/legacy/AdminLegacy", () => ({
  CreateEventWorkspace: () => <div>Mock Create Event Workspace</div>,
  EventManagementModal: ({ initialTab, scoresView }: { initialTab?: string; scoresView?: string }) => (
    <div>{`Mock Event Workspace:${initialTab ?? "none"}:${scoresView ?? "none"}`}</div>
  ),
}));

vi.mock("@/features/admin/components/EventsList", () => ({
  EventsList: ({ onSelectEvent }: { onSelectEvent: (eventId: string) => void }) => (
    <button type="button" onClick={() => onSelectEvent("event123")}>
      Mock Events List
    </button>
  ),
}));

function renderAdmin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminHomeRoute />} />
          <Route path="events/new" element={<AdminCreateEventRoute />} />
          <Route path="events/:eventId" element={<AdminEventRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Unified Admin Workspace Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
  });

  it("blocks non-admin users", () => {
    queryResults.set("loggedInUser", { _id: "user123" });
    queryResults.set("isUserAdmin", false);

    renderAdmin("/admin");

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("renders create route in unified shell", () => {
    queryResults.set("loggedInUser", { _id: "user123" });
    queryResults.set("isUserAdmin", true);

    renderAdmin("/admin/events/new");

    expect(screen.getByText("Create Event")).toBeInTheDocument();
    expect(screen.getByText("Mock Create Event Workspace")).toBeInTheDocument();
  });

  it("maps query params to event tab and scores view", () => {
    queryResults.set("loggedInUser", { _id: "user123" });
    queryResults.set("isUserAdmin", true);

    renderAdmin("/admin/events/event123?tab=scores&scoresView=winners");

    expect(screen.getByText("Mock Event Workspace:scores:winners")).toBeInTheDocument();
  });

  it("maps prizes tab query param correctly", () => {
    queryResults.set("loggedInUser", { _id: "user123" });
    queryResults.set("isUserAdmin", true);

    renderAdmin("/admin/events/event123?tab=prizes");

    expect(screen.getByText("Mock Event Workspace:prizes:overview")).toBeInTheDocument();
  });

  it("navigates from event list selection to event route", () => {
    queryResults.set("loggedInUser", { _id: "user123" });
    queryResults.set("isUserAdmin", true);

    renderAdmin("/admin");

    fireEvent.click(screen.getByText("Mock Events List"));

    expect(screen.getByText("Mock Event Workspace:details:overview")).toBeInTheDocument();
  });
});

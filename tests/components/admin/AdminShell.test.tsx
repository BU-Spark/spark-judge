import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName } from "convex/server";
const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
}));
import { AdminShell } from "../../../src/features/admin/shell/AdminShell";

function renderAdmin(user: unknown, isAdmin: boolean | undefined) {
  query.mockImplementation((ref) =>
    getFunctionName(ref) === "auth:loggedInUser" ? user : isAdmin,
  );
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<h1>Private event management</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
describe("admin route access", () => {
  it("requires sign-in before showing the workspace", () => {
    renderAdmin(null, false);
    expect(
      screen.getByRole("heading", { name: "Sign In Required" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Private event management"),
    ).not.toBeInTheDocument();
  });
  it("rejects a signed-in participant", () => {
    renderAdmin({ name: "Participant" }, false);
    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Private event management"),
    ).not.toBeInTheDocument();
  });
  it("waits for the role check before showing private content", () => {
    renderAdmin({ name: "Admin" }, undefined);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Verifying admin access",
    );
    expect(
      screen.queryByText("Private event management"),
    ).not.toBeInTheDocument();
  });
  it("shows the workspace to an authenticated admin", () => {
    renderAdmin({ name: "Admin" }, true);
    expect(
      screen.getByRole("heading", { name: "Private event management" }),
    ).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PlatformHeader } from "../../src/components/home/PlatformHeader";

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => {
    const name = getFunctionName(ref as never);
    if (name === "auth:loggedInUser") return { name: "Ada Lovelace" };
    if (name === "events:isUserAdmin") return false;
    throw new Error(`Unexpected query ${name}`);
  },
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../src/components/auth/SignInDialog", () => ({
  SignInDialog: () => null,
}));

function openAccountMenu() {
  render(
    <MemoryRouter>
      <main>Page content</main>
      <PlatformHeader homepage />
    </MemoryRouter>,
  );
  const summary = screen.getByText("My account");
  const menu = summary.closest("details")!;
  menu.open = true;
  return { menu, summary };
}

describe("PlatformHeader account menu", () => {
  it("closes on a click outside the menu", () => {
    const { menu } = openAccountMenu();
    fireEvent.pointerDown(screen.getByText("Page content"));
    expect(menu.open).toBe(false);
  });

  it("stays open on a click inside the menu", () => {
    const { menu } = openAccountMenu();
    fireEvent.pointerDown(screen.getByText("Ada Lovelace"));
    expect(menu.open).toBe(true);
  });

  it("closes on Escape and returns focus to the toggle", () => {
    const { menu, summary } = openAccountMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu.open).toBe(false);
    expect(summary).toHaveFocus();
  });
});

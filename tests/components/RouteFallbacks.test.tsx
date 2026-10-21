import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RouteBoundary, UnavailablePage, isConvexIdShape } from "../../src/components/RouteFallbacks";

function Boom(): never {
  throw new Error("[CONVEX Q(events:getEvent)] ArgumentValidationError: Value does not match validator");
}

describe("route fallbacks", () => {
  it("rejects malformed IDs before they reach a query", () => {
    expect(isConvexIdShape("not-an-id")).toBe(false);
    expect(isConvexIdShape(undefined)).toBe(false);
    expect(isConvexIdShape("jd7a8k2m3n4p5q6r7s8t9v0w1x2y3z4a")).toBe(true);
  });

  it("contains a page failure without showing raw error text and offers a way back", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <MemoryRouter initialEntries={["/event/abc/team/def"]}>
        <header>Site header</header>
        <Routes>
          <Route path="*" element={<RouteBoundary><Boom /></RouteBoundary>} />
          <Route path="/event/abc" element={<p>Event page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Site header")).toBeInTheDocument();
    expect(screen.getByText("This page couldn't load")).toBeInTheDocument();
    expect(screen.queryByText(/ArgumentValidationError/)).not.toBeInTheDocument();
    expect(screen.getByText(/Reference/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to event" }));
  });

  it("explains an unavailable link with a working destination", () => {
    render(
      <MemoryRouter initialEntries={["/old-bookmark"]}>
        <Routes>
          <Route path="/" element={<p>Events home</p>} />
          <Route path="*" element={<UnavailablePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("This link isn't available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to events" }));
    expect(screen.getByText("Events home")).toBeInTheDocument();
  });
});

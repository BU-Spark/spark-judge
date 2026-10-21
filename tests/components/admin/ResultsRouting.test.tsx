import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useEventWorkspaceState } from "../../../src/features/admin/hooks/useEventWorkspaceState";
function Workspace() {
  const { tab, scoresView, setTab, setScoresView } = useEventWorkspaceState();
  const location = useLocation();
  return (
    <>
      <p>
        {tab}:{scoresView}
      </p>
      <output>{location.search}</output>
      <button onClick={() => setTab("scores")}>Scores</button>
      <button onClick={() => setScoresView("winners")}>Choose</button>
      <button onClick={() => setScoresView("overview")}>Review</button>
    </>
  );
}
describe("Results routes", () => {
  it.each(["?tab=winners", "?tab=results", "?tab=scores&scoresView=winners"])(
    "preserves %s and can return to Scores",
    (query) => {
      render(
        <MemoryRouter initialEntries={[`/admin/events/e${query}`]}>
          <Workspace />
        </MemoryRouter>,
      );
      expect(
        screen.getByText(
          query.includes("scoresView") ? "winners:winners" : "winners:overview",
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Scores" }));
      expect(screen.getByText("scores:overview")).toBeInTheDocument();
      expect(screen.getByRole("status").textContent).toBe("?tab=scores");
    },
  );
  it("keeps selection and review within the canonical Results URL", () => {
    render(
      <MemoryRouter initialEntries={["/admin/events/e?tab=scores"]}>
        <Workspace />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(screen.getByRole("status").textContent).toBe(
      "?tab=results&resultView=choose",
    );
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("status").textContent).toBe("?tab=results");
  });
});

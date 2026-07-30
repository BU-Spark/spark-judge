import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DesignPreview } from "../../src/features/design-preview/DesignPreview";

describe("DesignPreview", () => {
  it("renders the Maker Festival fidelity spike from local concept data", () => {
    render(
      <MemoryRouter initialEntries={["/design-preview?direction=festival&screen=home"]}>
        <DesignPreview />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tab", { name: /Maker Festival/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: /HackFest\s*Boston 2026/, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured projects", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Echo Grid")).toBeInTheDocument();
    expect(screen.getByText("Phase 0 fidelity spike")).toBeInTheDocument();
  });

  it("opens a deep-linked direction and screen using dummy content", () => {
    render(
      <MemoryRouter initialEntries={["/design-preview?direction=control&screen=score"]}>
        <DesignPreview />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tab", { name: /Mission Control/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Scoring wizard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Team dossier", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Interactive concept · Dummy data/)).toBeInTheDocument();
  });

  it("switches direction and screen without touching product data", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/design-preview"]}>
        <DesignPreview />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /Maker Festival/ }));
    await user.click(screen.getByRole("tab", { name: "Create event" }));

    expect(screen.getByRole("heading", { name: "Make some noise", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Civic Futures Hackathon")).toBeInTheDocument();
  });
});

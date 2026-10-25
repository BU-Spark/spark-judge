import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectMarkdown } from "@/components/ui/ProjectMarkdown";

describe("ProjectMarkdown", () => {
  it("renders Markdown with section headings, lists, emphasis, and safe links", () => {
    render(
      <ProjectMarkdown>
        {
          "## What it does\n\nExplore **health data**.\n\n- County map\n- [Source](https://example.com)\n\n| Data | Year |\n| --- | --- |\n| Health | 2026 |"
        }
      </ProjectMarkdown>,
    );
    expect(
      screen.getByRole("heading", { name: "What it does", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("health data").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("recovers flattened Devpost sections without treating the body as a heading", () => {
    const { container } = render(
      <ProjectMarkdown>
        {
          "## Inspiration Our team studies health. ## What it does Explore counties. ## How we built it We used JavaScript."
        }
      </ProjectMarkdown>,
    );
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Inspiration",
      "What it does",
      "How we built it",
    ]);
    expect(
      [...container.querySelectorAll("p")].map((p) => p.textContent),
    ).toEqual([
      "Our team studies health.",
      "Explore counties.",
      "We used JavaScript.",
    ]);
  });

  it("preserves ordinary text, multiline headings, and literal code", () => {
    const source =
      "## Inspiration for our project\n\nFirst line\nSecond line\n\n`## What it does`";
    const { container } = render(<ProjectMarkdown>{source}</ProjectMarkdown>);
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Inspiration for our project",
    );
    expect(container.querySelector("p")).toHaveTextContent(
      "First line Second line",
    );
    expect(container.querySelector("code")).toHaveTextContent(
      "## What it does",
    );
  });

  it("does not render supplied HTML, embedded images, or executable link URLs", () => {
    const { container } = render(
      <ProjectMarkdown>
        {
          '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n![tracker](https://example.com/pixel)\n\n[Click](javascript:alert%281%29)'
        }
      </ProjectMarkdown>,
    );
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getByText("Click").getAttribute("href")).not.toMatch(
      /^javascript:/,
    );
  });
});

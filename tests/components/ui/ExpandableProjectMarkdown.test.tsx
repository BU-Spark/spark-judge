import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpandableProjectMarkdown } from "@/components/ui/ExpandableProjectMarkdown";

afterEach(() => vi.restoreAllMocks());

describe("ExpandableProjectMarkdown", () => {
  it("shows short descriptions fully without a toggle", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
    render(
      <ExpandableProjectMarkdown>
        A short description.
      </ExpandableProjectMarkdown>,
    );
    expect(screen.getByText("A short description.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("expands overflowing Markdown, collapses again, and resets for new copy", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(800);
    const { rerender } = render(
      <ExpandableProjectMarkdown>
        {"## Inspiration\n\nLong description."}
      </ExpandableProjectMarkdown>,
    );
    const button = screen.getByRole("button", { name: "Show more" });
    const viewport = document.getElementById(
      button.getAttribute("aria-controls")!,
    )!;
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(viewport).toHaveStyle({ maxHeight: "320px", overflow: "hidden" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(viewport.style.maxHeight).toBe("");
    fireEvent.click(button);
    expect(button).toHaveTextContent("Show more");
    fireEvent.click(button);
    rerender(
      <ExpandableProjectMarkdown>
        Another long description.
      </ExpandableProjectMarkdown>,
    );
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals clipped links when they receive keyboard focus", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(800);
    render(
      <ExpandableProjectMarkdown>
        {"Read the [project source](https://example.com)."}
      </ExpandableProjectMarkdown>,
    );
    fireEvent.focus(screen.getByRole("link"));
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

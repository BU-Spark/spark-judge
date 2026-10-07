import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectDescription } from "@/components/ui/ProjectDescription";

describe("ProjectDescription", () => {
  it("keeps the native disclosure, label, and copy independent", () => {
    render(<ProjectDescription projectName="SemesterMap" description="Plan your next semester." />);
    const summary = screen.getByLabelText("Description for SemesterMap");
    const details = summary.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(summary.querySelector(".project-description-show")).toHaveTextContent("Show description");
    expect(summary.querySelector(".project-description-hide")).toHaveTextContent("Hide description");
    expect(details.querySelector("p")).toHaveTextContent("Plan your next semester.");
    summary.click();
    expect(details).toHaveAttribute("open");
    summary.click();
    expect(details).not.toHaveAttribute("open");
  });

  it.each([undefined, "", "   "])("omits empty descriptions: %s", (description) => {
    const { container } = render(<ProjectDescription projectName="No copy" description={description} />);
    expect(container).toBeEmptyDOMElement();
  });
});

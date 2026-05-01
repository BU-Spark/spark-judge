import { describe, expect, it } from "vitest";
import {
  formatRubricPercent,
  getRubricPercentTotal,
  getRubricPercentages,
  isRubricPercentTotalValid,
  rubricPercentToWeight,
} from "../../../src/lib/scoringWeights";

describe("scoring weight helpers", () => {
  it("converts rubric percentages to internal weights", () => {
    const percentages = [10, 15, 50, 25];
    const weights = percentages.map((percent) =>
      rubricPercentToWeight(percent, percentages.length),
    );

    expect(weights).toEqual([0.4, 0.6, 2, 1]);
  });

  it("derives rubric percentages from existing weights", () => {
    const categories = [
      { name: "Product-Need Fit", weight: 0.4 },
      { name: "Impact", weight: 0.6 },
      { name: "Technical Execution", weight: 2 },
      { name: "Design", weight: 1 },
    ];

    expect(getRubricPercentages(categories)).toEqual([
      { name: "Product-Need Fit", weight: 0.4, percent: 10 },
      { name: "Impact", weight: 0.6, percent: 15 },
      { name: "Technical Execution", weight: 2, percent: 50 },
      { name: "Design", weight: 1, percent: 25 },
    ]);
  });

  it("validates visible rubric totals", () => {
    expect(
      isRubricPercentTotalValid(
        getRubricPercentTotal([
          { name: "Technical Execution", rubricPercent: 50 },
          { name: "Design", rubricPercent: 25 },
          { name: "Impact", rubricPercent: 15 },
          { name: "Product-Need Fit", rubricPercent: 10 },
        ]),
      ),
    ).toBe(true);

    expect(
      isRubricPercentTotalValid(
        getRubricPercentTotal([
          { name: "Technical Execution", rubricPercent: 50 },
          { name: "Design", rubricPercent: 25 },
        ]),
      ),
    ).toBe(false);
  });

  it("formats percentages without unnecessary decimals", () => {
    expect(formatRubricPercent(25)).toBe("25%");
    expect(formatRubricPercent(12.5)).toBe("12.5%");
  });
});

import { describe, it, expect } from "vitest";

function calculateTotalScore(
  categoryScores: Array<{
    category: string;
    score: number | null;
    optedOut?: boolean;
  }>,
  categories: Array<{ name: string; weight: number; optOutAllowed?: boolean }>
) {
  const totalConfiguredWeight =
    categories.reduce((sum, category) => sum + (category.weight ?? 1), 0) ||
    categories.length ||
    1;

  const categoryMeta = new Map(
    categories.map((c) => [
      c.name,
      { weight: c.weight ?? 1, optOutAllowed: c.optOutAllowed ?? false },
    ])
  );

  let weightedSum = 0;
  let usedWeight = 0;

  for (const cs of categoryScores) {
    const meta = categoryMeta.get(cs.category);
    if (!meta) continue;
    const isOptedOut = meta.optOutAllowed ? (cs.optedOut ?? false) : false;
    if (isOptedOut) continue;
    if (cs.score === null || typeof cs.score !== "number") continue;

    weightedSum += cs.score * meta.weight;
    usedWeight += meta.weight;
  }

  if (usedWeight === 0) return 0;

  const normalizedAverage = weightedSum / usedWeight;
  return normalizedAverage * totalConfiguredWeight;
}

describe("scores business logic", () => {
  describe("score calculation with category weights", () => {
    it("should calculate total score with equal weights", () => {
      const categoryScores = [
        { category: "Innovation", score: 8 },
        { category: "Execution", score: 7 },
      ];
      const categories = [
        { name: "Innovation", weight: 1 },
        { name: "Execution", weight: 1 },
      ];

      const totalScore = calculateTotalScore(categoryScores, categories);

      expect(totalScore).toBe(15); // 8 + 7
    });

    it("should calculate total score with different weights", () => {
      const categoryScores = [
        { category: "Innovation", score: 8 },
        { category: "Execution", score: 7 },
      ];
      const categories = [
        { name: "Innovation", weight: 2 },
        { name: "Execution", weight: 1 },
      ];

      const totalScore = calculateTotalScore(categoryScores, categories);

      expect(totalScore).toBe(23); // (8 * 2) + (7 * 1) = 16 + 7
    });

    it("should skip categories that are not in the event config", () => {
      const categoryScores = [{ category: "Unknown", score: 5 }];
      const categories = [{ name: "Innovation", weight: 2 }];

      const totalScore = calculateTotalScore(categoryScores, categories);

      expect(totalScore).toBe(0);
    });

    it("should treat opted-out categories as neutral and normalize total", () => {
      const categoryScores = [
        { category: "Innovation", score: 5 },
        { category: "Execution", score: null, optedOut: true },
      ];
      const categories = [
        { name: "Innovation", weight: 1, optOutAllowed: true },
        { name: "Execution", weight: 1, optOutAllowed: true },
      ];

      const totalScore = calculateTotalScore(categoryScores, categories);

      // Weighted average of provided categories (5) scaled across both weights -> 10
      expect(totalScore).toBe(10);
    });
  });

  describe("score aggregation", () => {
    it("should calculate average score correctly", () => {
      const scores = [
        { totalScore: 80 },
        { totalScore: 90 },
        { totalScore: 70 },
      ];
      const avgTotal =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
          : 0;

      expect(avgTotal).toBe(80); // (80 + 90 + 70) / 3
    });

    it("should return 0 for empty scores array", () => {
      const scores: { totalScore: number }[] = [];
      const avgTotal =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
          : 0;

      expect(avgTotal).toBe(0);
    });

    it("should calculate category averages correctly", () => {
      const teamScores = [
        { categoryScores: [{ category: "Innovation", score: 8 }] },
        { categoryScores: [{ category: "Innovation", score: 9 }] },
        { categoryScores: [{ category: "Innovation", score: 7 }] },
      ];

      const categoryScores = teamScores
        .map((s) => s.categoryScores.find((cs) => cs.category === "Innovation"))
        .filter((cs) => cs !== undefined)
        .map((cs) => cs!.score);

      const avg =
        categoryScores.length > 0
          ? categoryScores.reduce((sum, score) => sum + score, 0) /
            categoryScores.length
          : 0;

      expect(avg).toBe(8); // (8 + 9 + 7) / 3
    });
  });
});

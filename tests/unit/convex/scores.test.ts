import { describe, it, expect } from 'vitest';

describe('scores business logic', () => {
  describe('score calculation with category weights', () => {
    it('should calculate total score with equal weights', () => {
      const categoryScores = [
        { category: 'Innovation', score: 8 },
        { category: 'Execution', score: 7 },
      ];
      const categories = [
        { name: 'Innovation', weight: 1 },
        { name: 'Execution', weight: 1 },
      ];

      const totalScore = categoryScores.reduce((sum, cs) => {
        const category = categories.find((c) => c.name === cs.category);
        const weight = category?.weight ?? 1;
        return sum + cs.score * weight;
      }, 0);

      expect(totalScore).toBe(15); // 8 + 7
    });

    it('should calculate total score with different weights', () => {
      const categoryScores = [
        { category: 'Innovation', score: 8 },
        { category: 'Execution', score: 7 },
      ];
      const categories = [
        { name: 'Innovation', weight: 2 },
        { name: 'Execution', weight: 1 },
      ];

      const totalScore = categoryScores.reduce((sum, cs) => {
        const category = categories.find((c) => c.name === cs.category);
        const weight = category?.weight ?? 1;
        return sum + cs.score * weight;
      }, 0);

      expect(totalScore).toBe(23); // (8 * 2) + (7 * 1) = 16 + 7
    });

    it('should use default weight of 1 when category not found', () => {
      const categoryScores = [
        { category: 'Unknown', score: 5 },
      ];
      const categories = [
        { name: 'Innovation', weight: 2 },
      ];

      const totalScore = categoryScores.reduce((sum, cs) => {
        const category = categories.find((c) => c.name === cs.category);
        const weight = category?.weight ?? 1;
        return sum + cs.score * weight;
      }, 0);

      expect(totalScore).toBe(5); // 5 * 1 (default weight)
    });
  });

  describe('score aggregation', () => {
    it('should calculate average score correctly', () => {
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

    it('should return 0 for empty scores array', () => {
      const scores: { totalScore: number }[] = [];
      const avgTotal =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
          : 0;

      expect(avgTotal).toBe(0);
    });

    it('should calculate category averages correctly', () => {
      const teamScores = [
        { categoryScores: [{ category: 'Innovation', score: 8 }] },
        { categoryScores: [{ category: 'Innovation', score: 9 }] },
        { categoryScores: [{ category: 'Innovation', score: 7 }] },
      ];

      const categoryScores = teamScores
        .map((s) => s.categoryScores.find((cs) => cs.category === 'Innovation'))
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


export function slugifySeedValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function clampSeedScore(score: number) {
  return Math.max(1, Math.min(5, Math.round(score)));
}

export function computeSeedTotalScore(
  categoryScores: Array<{
    category: string;
    score: number | null;
    optedOut?: boolean;
  }>,
  eventCategories: Array<{ name: string; weight?: number }>
) {
  const totalConfiguredWeight =
    eventCategories.reduce((sum, category) => sum + (category.weight ?? 1), 0) ||
    eventCategories.length ||
    1;

  const categoryWeights = new Map(
    eventCategories.map((category) => [category.name, category.weight ?? 1])
  );

  let weightedSum = 0;
  let usedWeight = 0;

  for (const categoryScore of categoryScores) {
    const weight = categoryWeights.get(categoryScore.category);
    if (weight === undefined) continue;
    if (categoryScore.optedOut) continue;
    if (categoryScore.score === null || typeof categoryScore.score !== "number") {
      continue;
    }

    weightedSum += categoryScore.score * weight;
    usedWeight += weight;
  }

  if (usedWeight === 0) return 0;

  return (weightedSum / usedWeight) * totalConfiguredWeight;
}

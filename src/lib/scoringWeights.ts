export type WeightedCategory = {
  name: string;
  weight?: number;
};

const DEFAULT_CATEGORY_WEIGHT = 1;

export function roundRubricPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function formatRubricPercent(value: number) {
  const rounded = roundRubricPercent(value);
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function getCategoryWeight(category: WeightedCategory) {
  return Number.isFinite(category.weight)
    ? (category.weight as number)
    : DEFAULT_CATEGORY_WEIGHT;
}

export function getTotalCategoryWeight(categories: WeightedCategory[]) {
  const total = categories.reduce(
    (sum, category) => sum + getCategoryWeight(category),
    0,
  );
  return total > 0 ? total : categories.length || 1;
}

export function getRubricPercentages(categories: WeightedCategory[]) {
  const totalWeight = getTotalCategoryWeight(categories);
  return categories.map((category) => ({
    name: category.name,
    weight: getCategoryWeight(category),
    percent: roundRubricPercent(
      (getCategoryWeight(category) / totalWeight) * 100,
    ),
  }));
}

export function rubricPercentToWeight(
  rubricPercent: number,
  categoryCount: number,
) {
  const safePercent = Number.isFinite(rubricPercent)
    ? Math.max(0, rubricPercent)
    : 0;
  const safeCategoryCount = Math.max(1, categoryCount);
  return Number(((safePercent / 100) * safeCategoryCount).toFixed(4));
}

export function getRubricPercentTotal(
  categories: Array<{ name?: string; rubricPercent?: number }>,
) {
  return roundRubricPercent(
    categories
      .filter((category) => (category.name ?? "").trim().length > 0)
      .reduce(
        (sum, category) =>
          sum +
          (Number.isFinite(category.rubricPercent)
            ? (category.rubricPercent as number)
            : 0),
        0,
      ),
  );
}

export function isRubricPercentTotalValid(total: number) {
  return Math.abs(total - 100) <= 0.1;
}

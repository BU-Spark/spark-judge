export type EventBrand = "dsx" | "civichacks" | "demoday";

/** Recurring event series with their own muted palette, matched by name so each year's edition inherits it. */
export function getEventBrand(name: string | undefined): EventBrand | undefined {
  const key = (name ?? "").toLowerCase().replace(/[^a-z+]/g, "");
  if (key.includes("ds+x") || key.includes("dsplusx")) return "dsx";
  if (key.includes("civichacks")) return "civichacks";
  if (key.includes("demoday")) return "demoday";
  return undefined;
}

export function eventBrandClass(name: string | undefined) {
  const brand = getEventBrand(name);
  return brand ? ` hp-brand-${brand}` : "";
}

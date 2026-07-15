import type { CupThingCategory } from "@cupthings/shared";

export const categoryLabels: Record<CupThingCategory, string> = {
  coffee: "Coffee",
  wine: "Wine",
  dessert: "Dessert",
  other: "Other"
};

export const categoryOptions = Object.entries(categoryLabels) as [CupThingCategory, string][];

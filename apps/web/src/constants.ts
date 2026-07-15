import type { CupThingCategory } from "@cupthings/shared";

export const categoryLabels: Record<CupThingCategory, string> = {
  coffee: "Coffee",
  wine: "Wine",
  dessert: "Dessert",
  other: "Other"
};

export const categoryOptions = Object.entries(categoryLabels) as [CupThingCategory, string][];

export const ratingOptions = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

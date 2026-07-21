import { and, desc, eq, gte, lte } from "drizzle-orm";
import { cupThingCategories, type ReviewStats } from "@cupthings/shared";
import { db } from "../db/client.js";
import { cupThings } from "../db/schema.js";
import { toCupThing } from "../mappers.js";

export async function getReview(profileId: string, from: string, to: string, category?: string) {
  const rows = await db
    .select()
    .from(cupThings)
    .where(and(
      eq(cupThings.profileId, profileId),
      category ? eq(cupThings.category, category as typeof cupThings.category.enumValues[number]) : undefined,
      gte(cupThings.consumedAt, new Date(from)),
      lte(cupThings.consumedAt, new Date(to))
    ))
    .orderBy(desc(cupThings.consumedAt));

  const countByCategory = Object.fromEntries(cupThingCategories.map((item) => [item, 0])) as ReviewStats["countByCategory"];
  let ratingTotal = 0;
  let ratedCount = 0;
  for (const row of rows) {
    countByCategory[row.category] += 1;
    if (row.ratingHalfSteps != null) {
      ratingTotal += Number(row.ratingHalfSteps);
      ratedCount += 1;
    }
  }

  const stats: ReviewStats = {
    totalCount: rows.length,
    countByCategory,
    averageRating: ratedCount ? ratingTotal / ratedCount / 2 : null
  };
  return { records: rows.map(toCupThing), stats };
}

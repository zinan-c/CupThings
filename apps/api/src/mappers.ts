import type { CupThing, Profile } from "@cupthings/shared";
import type { cupThings, profiles } from "./db/schema.js";

type ProfileRow = typeof profiles.$inferSelect;
type CupThingRow = typeof cupThings.$inferSelect;

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.displayName,
    hasAccount: row.accountId != null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toCupThing(row: CupThingRow): CupThing {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    consumedAt: row.consumedAt.toISOString(),
    location: row.location ?? undefined,
    style: row.style ?? undefined,
    flavors: row.flavors,
    rating: row.ratingHalfSteps == null ? undefined : row.ratingHalfSteps / 2,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toRatingHalfSteps(rating: number | undefined) {
  return rating == null ? null : Math.round(rating * 2);
}

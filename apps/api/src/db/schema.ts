import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

const cupThingCategories = ["coffee", "wine", "dessert", "other"] as const;

export const cupThingCategory = pgEnum("cup_thing_category", cupThingCategories);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const cupThings = pgTable(
  "cup_things",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: cupThingCategory("category").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull(),
    location: text("location"),
    style: text("style"),
    flavors: text("flavors").array().notNull().default([]),
    ratingHalfSteps: integer("rating_half_steps"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    profileConsumedAtIdx: index("cup_things_profile_consumed_at_idx").on(table.profileId, table.consumedAt),
    profileCategoryIdx: index("cup_things_profile_category_idx").on(table.profileId, table.category)
  })
);

export const profileRelations = relations(profiles, ({ many }) => ({
  cupThings: many(cupThings)
}));

export const cupThingRelations = relations(cupThings, ({ one }) => ({
  profile: one(profiles, {
    fields: [cupThings.profileId],
    references: [profiles.id]
  })
}));

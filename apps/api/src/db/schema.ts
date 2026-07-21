import { relations, sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid, integer, uniqueIndex } from "drizzle-orm/pg-core";

const cupThingCategories = ["coffee", "wine", "dessert", "other"] as const;

export const cupThingCategory = pgEnum("cup_thing_category", cupThingCategories);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  accountIdUnique: uniqueIndex("profiles_account_id_unique_idx").on(table.accountId)
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  accessTokenHash: text("access_token_hash").notNull().unique(),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => ({
  profileIdx: index("sessions_profile_id_idx").on(table.profileId),
  accessExpiryIdx: index("sessions_access_expires_at_idx").on(table.accessExpiresAt),
  refreshExpiryIdx: index("sessions_refresh_expires_at_idx").on(table.refreshExpiresAt)
}));

export const loginChallenges = pgTable("login_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  tokenHash: text("token_hash").notNull().unique(),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  emailCreatedIdx: index("login_challenges_email_created_at_idx").on(table.email, table.createdAt),
  expiresIdx: index("login_challenges_expires_at_idx").on(table.expiresAt)
}));

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
    ratingRange: check(
      "cup_things_rating_half_steps_range",
      sql`${table.ratingHalfSteps} is null or (${table.ratingHalfSteps} between 2 and 10)`
    ),
    profileConsumedAtIdx: index("cup_things_profile_consumed_at_idx").on(table.profileId, table.consumedAt),
    profileCategoryIdx: index("cup_things_profile_category_idx").on(table.profileId, table.category)
  })
);

export const profileRelations = relations(profiles, ({ many }) => ({
  cupThings: many(cupThings),
  sessions: many(sessions),
  loginChallenges: many(loginChallenges)
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  profile: one(profiles)
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  profile: one(profiles, {
    fields: [sessions.profileId],
    references: [profiles.id]
  })
}));

export const loginChallengeRelations = relations(loginChallenges, ({ one }) => ({
  profile: one(profiles, {
    fields: [loginChallenges.profileId],
    references: [profiles.id]
  })
}));

export const cupThingRelations = relations(cupThings, ({ one }) => ({
  profile: one(profiles, {
    fields: [cupThings.profileId],
    references: [profiles.id]
  })
}));

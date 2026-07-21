CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "login_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"profile_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"access_token_hash" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_token_hash_unique";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "account_id" uuid;--> statement-breakpoint
INSERT INTO "sessions" ("profile_id", "access_token_hash", "refresh_token_hash", "access_expires_at", "refresh_expires_at", "created_at")
SELECT "id", "token_hash", 'legacy-' || "token_hash", now() + interval '30 days', now() + interval '365 days', "created_at"
FROM "profiles";--> statement-breakpoint
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_challenges_email_created_at_idx" ON "login_challenges" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_challenges_expires_at_idx" ON "login_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_profile_id_idx" ON "sessions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "sessions_access_expires_at_idx" ON "sessions" USING btree ("access_expires_at");--> statement-breakpoint
CREATE INDEX "sessions_refresh_expires_at_idx" ON "sessions" USING btree ("refresh_expires_at");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_account_id_unique_idx" ON "profiles" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "token_hash";

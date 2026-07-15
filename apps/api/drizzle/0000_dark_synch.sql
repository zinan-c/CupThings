CREATE TYPE "public"."cup_thing_category" AS ENUM('coffee', 'wine', 'dessert', 'other');--> statement-breakpoint
CREATE TABLE "cup_things" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "cup_thing_category" NOT NULL,
	"consumed_at" timestamp with time zone NOT NULL,
	"location" text,
	"style" text,
	"flavors" text[] DEFAULT '{}' NOT NULL,
	"rating_half_steps" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "cup_things" ADD CONSTRAINT "cup_things_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cup_things_profile_consumed_at_idx" ON "cup_things" USING btree ("profile_id","consumed_at");--> statement-breakpoint
CREATE INDEX "cup_things_profile_category_idx" ON "cup_things" USING btree ("profile_id","category");
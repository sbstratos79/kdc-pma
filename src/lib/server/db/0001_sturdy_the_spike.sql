ALTER TABLE "architects" RENAME COLUMN "first_name" TO "name";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "architect_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "architects" DROP COLUMN "last_name";
-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."Priority" AS ENUM('High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."Status" AS ENUM('Planning', 'In Progress', 'Completed', 'On Hold', 'Cancelled');--> statement-breakpoint
CREATE TABLE "architects" (
	"architect_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"phone_number" bigint
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"name" text NOT NULL,
	"description" text,
	"start_date" date,
	"due_date" date,
	"status" "Status",
	"priority" "Priority",
	"architect_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"project_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" date,
	"due_date" date,
	"status" "Status",
	"priority" "Priority",
	CONSTRAINT "Projects_Name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"subtask_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "Status",
	"task_id" uuid
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_architect_id_fkey" FOREIGN KEY ("architect_id") REFERENCES "public"."architects"("architect_id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE cascade ON UPDATE cascade;
*/
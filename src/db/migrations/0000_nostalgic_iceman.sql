CREATE TABLE "Permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "RolePermissions" (
	"roleId" integer NOT NULL,
	"permissionId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "RolePermissions_roleId_permissionId_pk" PRIMARY KEY("roleId","permissionId")
);
--> statement-breakpoint
CREATE TABLE "Roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"accessLevel" text DEFAULT 'any' NOT NULL,
	CONSTRAINT "Roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"roleId" integer DEFAULT 2 NOT NULL,
	"isVerified" boolean DEFAULT false,
	"verificationToken" text,
	"verifiedAt" timestamp,
	"passwordResetToken" text,
	"passwordResetExpires" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_roleId_Roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."Roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_permissionId_Permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."Permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_roleId_Roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."Roles"("id") ON DELETE no action ON UPDATE no action;
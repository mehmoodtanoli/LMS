-- Add isActive status flags for Super Admin activate/deactivate management.
-- Both default to true so existing laboratories and users remain active.

ALTER TABLE "laboratories" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

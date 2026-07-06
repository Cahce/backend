-- Add "project" (Đồ án) to the TemplateCategory enum, positioned after "thesis"
-- so the DB value order matches prisma/schema.prisma.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` runs inside Prisma's migration transaction.
-- PostgreSQL 12+ allows this as long as the new value is not USED in the same
-- transaction (it isn't here). On PostgreSQL < 12 this must run outside a
-- transaction block.
ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'project' AFTER 'thesis';

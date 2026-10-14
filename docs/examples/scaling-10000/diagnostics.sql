-- READ-ONLY. Run against the intended database with a monitoring role.
-- pg_stat_statements must have been installed/configured by the DBA separately.
SELECT queryid, calls, round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms, rows,
       shared_blks_hit, shared_blks_read, temp_blks_written
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC LIMIT 20;

SELECT application_name, state, wait_event_type, wait_event, count(*)
FROM pg_stat_activity WHERE datname = current_database()
GROUP BY application_name, state, wait_event_type, wait_event;

SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname IN ('Project', 'ProjectEvent', 'CompileJob', 'File')
ORDER BY relname, indexrelname;

-- Candidate ONLY, after EXPLAIN on representative staging data.
-- Execute individually OUTSIDE a transaction in a reviewed migration:
-- CREATE INDEX CONCURRENTLY "Project_ownerId_updatedAt_id_idx"
--   ON "Project" ("ownerId", "updatedAt" DESC, "id" DESC);
-- Prisma equivalent when adopting the migration:
-- @@index([ownerId, updatedAt(sort: Desc), id(sort: Desc)],
--         map: "Project_ownerId_updatedAt_id_idx")
-- Never assume IF NOT EXISTS proves a prior failed index is valid.

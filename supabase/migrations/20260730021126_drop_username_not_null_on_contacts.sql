-- The `contacts` table was originally a single-tenant demo with a required
-- `username` column. The multi-user contacts system (migration 20260729035800)
-- uses `contact_email` / `contact_name` instead and never sets `username`.
-- The leftover NOT NULL constraint on `username` causes every new contact
-- insert to fail with "null value in column username violates not-null
-- constraint". Drop the NOT NULL so new multi-user rows can omit it.
-- The UNIQUE constraint on username is retained; Postgres allows multiple
-- NULLs in a UNIQUE column, so this is safe.

ALTER TABLE contacts ALTER COLUMN username DROP NOT NULL;
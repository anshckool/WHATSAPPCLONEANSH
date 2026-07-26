/*
# Focus Mode (Deep Work) feature

## Summary
Adds a Focus Mode / "Deep Work" capability to the chat app. The app user (Ansh)
can toggle a timed focus block. While active, any contact who sends a direct
message to Ansh automatically receives a single system auto-reply notifying them
that Ansh is in a deep-work execution block and when it ends. Each sender receives
the auto-reply at most once per focus session, enforced by a database unique
constraint so duplicate replies are impossible even across multiple clients/tabs.

## 1. New Tables
- `app_user`
  - Singleton (single-tenant app, one row) holding the app user's profile and
    Focus Mode state. The frontend reads the single row and updates it when the
    user toggles Focus Mode; a realtime subscription mirrors backend changes to
    every open tab.
  - `id` (uuid, primary key)
  - `name` (text, not null) — display name, seeded with "Ansh"
  - `is_focus_mode_active` (boolean, not null, default false)
  - `focus_end_time` (timestamptz, nullable) — when the current focus block ends
  - `focus_session_id` (text, nullable) — unique id generated per focus activation,
    used to group/dedupe auto-replies per session
  - `updated_at` (timestamptz, default now())
- `focus_auto_replies`
  - Dedup ledger recording which (focus_session_id, contact_id) pairs have already
    been auto-replied, enforcing "once per sender per session".
  - `id` (uuid, primary key)
  - `focus_session_id` (text, not null)
  - `contact_id` (uuid, not null, references contacts(id) ON DELETE CASCADE)
  - `created_at` (timestamptz, default now())
  - UNIQUE constraint on (focus_session_id, contact_id) — the core dedup guarantee

## 2. Modified Tables
- `messages`: add `is_system` boolean NOT NULL DEFAULT false. Marks system-generated
  auto-reply messages so the UI renders them as centered notices rather than chat
  bubbles. Existing rows backfill to false (metadata-only, no data loss).

## 3. Security
- Enable RLS on `app_user` and `focus_auto_replies`.
- Add SELECT/INSERT/UPDATE/DELETE policies (NOT FOR ALL) for `anon, authenticated`
  because this app has no sign-in screen — the anon-key frontend must read/write
  this data. `USING (true)` is acceptable here because all data is intentionally
  shared single-tenant demo data (documented per policy).
- `messages` already has anon CRUD policies; the new `is_system` column is covered
  by the existing table-level policies (no new policy needed).

## 4. Seed
- Insert one `app_user` row for "Ansh" if the table is empty (idempotent).
*/

-- app_user singleton: profile + focus state
CREATE TABLE IF NOT EXISTS app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_focus_mode_active boolean NOT NULL DEFAULT false,
  focus_end_time timestamptz,
  focus_session_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;

-- Dedup ledger for focus auto-replies (one row per sender per session)
CREATE TABLE IF NOT EXISTS focus_auto_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  focus_session_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT focus_auto_replies_session_contact_unique UNIQUE (focus_session_id, contact_id)
);

ALTER TABLE focus_auto_replies ENABLE ROW LEVEL SECURITY;

-- Add is_system column to messages (idempotent; metadata-only default backfill)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'is_system') THEN
    ALTER TABLE messages ADD COLUMN is_system boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- app_user policies (shared single-tenant data, no sign-in)
DROP POLICY IF EXISTS "anon_select_app_user" ON app_user;
CREATE POLICY "anon_select_app_user" ON app_user
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_user" ON app_user;
CREATE POLICY "anon_insert_app_user" ON app_user
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_user" ON app_user;
CREATE POLICY "anon_update_app_user" ON app_user
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_user" ON app_user;
CREATE POLICY "anon_delete_app_user" ON app_user
  FOR DELETE TO anon, authenticated USING (true);

-- focus_auto_replies policies (shared single-tenant data, no sign-in)
DROP POLICY IF EXISTS "anon_select_focus_auto_replies" ON focus_auto_replies;
CREATE POLICY "anon_select_focus_auto_replies" ON focus_auto_replies
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_focus_auto_replies" ON focus_auto_replies;
CREATE POLICY "anon_insert_focus_auto_replies" ON focus_auto_replies
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_focus_auto_replies" ON focus_auto_replies;
CREATE POLICY "anon_update_focus_auto_replies" ON focus_auto_replies
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_focus_auto_replies" ON focus_auto_replies;
CREATE POLICY "anon_delete_focus_auto_replies" ON focus_auto_replies
  FOR DELETE TO anon, authenticated USING (true);

-- Seed the singleton app user (Ansh) if the table is empty
INSERT INTO app_user (name, is_focus_mode_active)
SELECT 'Ansh', false
WHERE NOT EXISTS (SELECT 1 FROM app_user);

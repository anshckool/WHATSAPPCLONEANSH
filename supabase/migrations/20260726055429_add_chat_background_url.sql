/*
# Chat background customization

## Summary
Adds a per-user chat background image so the user can personalize the look of
their chat area. The image is uploaded from the user's computer into the existing
chat-media storage bucket and its public URL is stored on the singleton app_user
row. The chat area reads this URL and renders it as a dimmed background behind the
message list.

## 1. Modified Tables
- `app_user`: add `chat_background_url` (text, nullable). Null means the default
  dark background is shown. Metadata-only change, no data loss — existing rows
  backfill to null automatically.

## 2. Security
- `app_user` already has anon CRUD policies (shared single-tenant data, no sign-in),
  so the new column is readable/writable through the existing table-level policies.
  No new policy needed.

## 3. Notes
- Background images are stored in the existing public `chat-media` bucket under a
  `backgrounds/` prefix so they don't collide with message attachments.
- The frontend uploads, captures the public URL, and persists it via UPDATE.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'app_user' AND column_name = 'chat_background_url') THEN
    ALTER TABLE app_user ADD COLUMN chat_background_url text;
  END IF;
END $$;

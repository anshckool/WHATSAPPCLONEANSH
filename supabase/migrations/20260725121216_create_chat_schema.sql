/*
# Chat application schema (single-tenant, no sign-in)

1. New Tables
- `contacts`
  - `id` (uuid, primary key)
  - `username` (text, not null, unique) — the person you are chatting with
  - `avatar_color` (text) — key used to pick the initials-avatar gradient on the frontend
  - `created_at` (timestamptz)
- `messages`
  - `id` (uuid, primary key)
  - `contact_id` (uuid, foreign key -> contacts(id) ON DELETE CASCADE)
  - `is_from_me` (boolean, not null) — true = message sent by the app user, false = received from the contact
  - `content` (text, nullable) — the text body; null for media-only messages
  - `attachment_type` (text, nullable, CHECK in image|video|document) — kind of media attached
  - `attachment_url` (text, nullable) — public URL of the uploaded media in storage
  - `attachment_name` (text, nullable) — original file name for documents
  - `attachment_size` (bigint, nullable) — file size in bytes
  - `created_at` (timestamptz)

2. Storage
- Create a PUBLIC bucket `chat-media` for uploaded photos/videos/documents.
- Add RLS policies on `storage.objects` so the anon-key frontend can read and upload objects in the `chat-media` bucket (single-tenant shared demo data).

3. Security
- Enable RLS on `contacts` and `messages`.
- Add separate SELECT/INSERT/UPDATE/DELETE policies (NOT FOR ALL) for `anon, authenticated` because this app has no sign-in screen — the frontend operates as the anon role for its entire lifetime, so authenticated-only policies would make the data invisible.

4. Seed data
- Insert contacts including a user named "Ansh" plus a few others (each with a distinct avatar color).
- Insert seeded two-way messages with staggered timestamps so the conversation list shows a realistic last message and time, and each conversation has message history to load.
- Seed messages are guarded with `WHERE NOT EXISTS (SELECT 1 FROM messages)` so re-running the migration does not duplicate them.
*/

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  avatar_color text NOT NULL DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  is_from_me boolean NOT NULL,
  content text,
  attachment_type text CHECK (attachment_type IN ('image', 'video', 'document')),
  attachment_url text,
  attachment_name text,
  attachment_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_contact_created_idx
  ON messages (contact_id, created_at);

-- Contacts policies (shared demo data, no sign-in)
DROP POLICY IF EXISTS "anon_select_contacts" ON contacts;
CREATE POLICY "anon_select_contacts" ON contacts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_contacts" ON contacts;
CREATE POLICY "anon_insert_contacts" ON contacts
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_contacts" ON contacts;
CREATE POLICY "anon_update_contacts" ON contacts
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_contacts" ON contacts;
CREATE POLICY "anon_delete_contacts" ON contacts
  FOR DELETE TO anon, authenticated USING (true);

-- Messages policies (shared demo data, no sign-in)
DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages
  FOR DELETE TO anon, authenticated USING (true);

-- Public storage bucket for chat media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for the chat-media bucket (shared, public)
DROP POLICY IF EXISTS "anon_read_chat_media" ON storage.objects;
CREATE POLICY "anon_read_chat_media" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "anon_insert_chat_media" ON storage.objects;
CREATE POLICY "anon_insert_chat_media" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'chat-media');

-- Seed contacts (idempotent via unique username)
INSERT INTO contacts (username, avatar_color) VALUES
  ('Ansh', 'amber'),
  ('Maya', 'rose'),
  ('Liam', 'emerald'),
  ('Sofia', 'sky'),
  ('Noah', 'violet')
ON CONFLICT (username) DO NOTHING;

-- Seed messages only when the messages table is empty
INSERT INTO messages (contact_id, is_from_me, content, attachment_type, attachment_url, attachment_name, attachment_size, created_at)
SELECT c.id, v.is_from_me, v.content, v.attachment_type, v.attachment_url, v.attachment_name, v.attachment_size, v.created_at
FROM (VALUES
  -- Ansh conversation
  ('Ansh', false, 'Hey! Are we still on for the project review tomorrow?', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '26 minutes'),
  ('Ansh', true,  'Yeah, 10am works. I will share the slides tonight.', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '24 minutes'),
  ('Ansh', false, 'Perfect, send them over when ready.', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '22 minutes'),
  ('Ansh', true,  'Here is the deck.', 'document'::text, NULL::text, 'Q3-Review.pdf'::text, 1843200::bigint, now() - interval '20 minutes'),
  ('Ansh', false, 'Looks great, see you tomorrow!', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '3 minutes'),

  -- Maya conversation
  ('Maya', false, 'Did you see the new design mockups?', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '3 hours'),
  ('Maya', true,  'Yes! The hero section is stunning.', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '2 hours'),
  ('Maya', false, 'Agreed. Sending the source file.', 'image'::text, NULL::text, 'hero-mockup.png'::text, 524288::bigint, now() - interval '1 hour'),

  -- Liam conversation
  ('Liam', true,  'Thanks for the help earlier!', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '1 day'),
  ('Liam', false, 'Anytime. Catch you next week.', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '23 hours'),

  -- Sofia conversation
  ('Sofia', false, 'Team lunch on Friday?', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '2 days'),
  ('Sofia', true,  'Count me in.', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '2 days' + interval '5 minutes'),

  -- Noah conversation
  ('Noah', true,  'Welcome to the team!', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '5 days'),
  ('Noah', false, 'Excited to get started.', NULL::text, NULL::text, NULL::text, NULL::bigint, now() - interval '5 days' + interval '1 hour')
) AS v(username, is_from_me, content, attachment_type, attachment_url, attachment_name, attachment_size, created_at)
JOIN contacts c ON c.username = v.username
WHERE NOT EXISTS (SELECT 1 FROM messages);

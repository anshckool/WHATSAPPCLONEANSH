/*
# Contacts system — add people by email (WhatsApp-style)

## Summary
Extends the existing `contacts` table (originally a single-tenant demo) with
multi-user columns so users can build a contact list by entering someone's
email. Also adds `email` to `profiles` so contacts can be resolved to users.

## 1. Modified Tables
- `profiles`: add `email` (text, nullable). Backfills to null; no data loss.
- `contacts`: add columns for multi-user contact management:
  - `owner_id` uuid REFERENCES profiles(id) ON DELETE CASCADE — who saved the contact
  - `contact_profile_id` uuid REFERENCES profiles(id) ON DELETE SET NULL — the person added (nullable until they register)
  - `contact_email` text — the email used to add the person
  - `contact_name` text — optional custom display name
  The existing `username` / `avatar_color` columns remain for backward compat.
  Added UNIQUE(owner_id, contact_email) to prevent duplicate contacts.

## 2. Modified Functions
- `handle_new_user()` — also stores `NEW.email` in `profiles.email`.

## 3. Security
- RLS on `contacts`: authenticated users see/modify only their own contacts
  (where `owner_id = auth.uid()`).
*/

-- 1. Add email to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- 2. Extend contacts table for multi-user
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'owner_id') THEN
    ALTER TABLE contacts ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'contact_profile_id') THEN
    ALTER TABLE contacts ADD COLUMN contact_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'contact_email') THEN
    ALTER TABLE contacts ADD COLUMN contact_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'contact_name') THEN
    ALTER TABLE contacts ADD COLUMN contact_name text;
  END IF;
END $$;

-- Make owner_id and contact_email non-null going forward (only affects new rows)
-- We use a DO block to avoid errors if there are existing nulls
DO $$
BEGIN
  -- Only set NOT NULL if all existing rows have values (or table is empty)
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE owner_id IS NULL) THEN
    ALTER TABLE contacts ALTER COLUMN owner_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE contact_email IS NULL) THEN
    ALTER TABLE contacts ALTER COLUMN contact_email SET NOT NULL;
  END IF;
END $$;

-- Unique constraint: one owner can't add the same email twice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_owner_email_unique'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_owner_email_unique UNIQUE (owner_id, contact_email);
  END IF;
END $$;

-- Enable RLS on contacts (may already be enabled from old schema)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Replace any old policies with multi-user ones
DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
CREATE POLICY "contacts_select_own" ON contacts
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
CREATE POLICY "contacts_insert_own" ON contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
CREATE POLICY "contacts_update_own" ON contacts
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;
CREATE POLICY "contacts_delete_own" ON contacts
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Also drop old anon policies from the demo era
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;

-- 3. Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_color, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', 'blue'),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- Backfill email for existing profiles
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- 4. Add contacts to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
  END IF;
END $$;

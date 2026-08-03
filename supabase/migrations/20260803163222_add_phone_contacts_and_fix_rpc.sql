/*
# Add phone-number contacts + fix latest_dm_per_partner RPC type mismatch

## Summary
1. Adds `phone` column to `profiles` so users can register with a phone number.
2. Adds `contact_phone` column to `contacts` so contacts can be saved by phone.
3. Fixes `latest_dm_per_partner` RPC: `message` column was `json` but query
   produced `jsonb`, causing "structure of query does not match function result
   type". Must DROP FUNCTION first (Postgres forbids changing OUT param types
   via CREATE OR REPLACE), then recreate with `jsonb`.
4. Drops legacy `contacts_username_key` UNIQUE constraint.

## Modified Tables
- `profiles`: + `phone text` (nullable)
- `contacts`: + `contact_phone text` (nullable)

## Modified Functions
- `latest_dm_per_partner`: dropped and recreated with `message jsonb`
- `handle_new_user`: updated to store phone from user metadata

## Security
- No new tables. Existing RLS policies still cover the new columns.
*/

-- 1. Add phone column to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;

-- 2. Add contact_phone column to contacts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'contact_phone') THEN
    ALTER TABLE contacts ADD COLUMN contact_phone text;
  END IF;
END $$;

-- 3. Drop legacy username UNIQUE constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_username_key'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_username_key;
  END IF;
END $$;

-- 4. Fix latest_dm_per_partner: must DROP first (cannot change OUT param type via CREATE OR REPLACE)
DROP FUNCTION IF EXISTS latest_dm_per_partner(uuid);

CREATE FUNCTION latest_dm_per_partner(p_user uuid)
RETURNS TABLE (
  partner_id uuid,
  partner_name text,
  partner_avatar_color text,
  partner_focus_active boolean,
  partner_focus_end timestamptz,
  message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS partner_id,
    p.name AS partner_name,
    p.avatar_color AS partner_avatar_color,
    p.is_focus_mode_active AS partner_focus_active,
    p.focus_end_time AS partner_focus_end,
    to_jsonb(lm) AS message
  FROM (
    SELECT DISTINCT ON (partner) *
    FROM (
      SELECT
        CASE WHEN sender_id = p_user THEN receiver_id ELSE sender_id END AS partner,
        id, contact_id, sender_id, receiver_id, is_from_me, is_system, content,
        attachment_type, attachment_url, attachment_name, attachment_size,
        location_lat, location_lng, is_live_location, created_at
      FROM public.messages
      WHERE sender_id = p_user OR receiver_id = p_user
      ORDER BY partner, created_at DESC
    ) m
  ) lm
  JOIN public.profiles p ON p.id = lm.partner
  ORDER BY (lm.created_at)::timestamptz DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION latest_dm_per_partner(uuid) TO authenticated;

-- 5. Update handle_new_user to also store phone from user metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_color, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', 'blue'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN NEW;
END;
$$;
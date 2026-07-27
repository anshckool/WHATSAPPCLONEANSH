/*
# Multi-user authentication + real-time DMs (retry: fix realtime syntax)

Same migration as add_multi_user_auth_and_dms but fixes the
ALTER PUBLICATION syntax (IF NOT EXISTS not supported for ADD TABLE).
Re-running is safe — all statements are idempotent.
*/

-- 1. profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_color text NOT NULL DEFAULT 'blue',
  is_focus_mode_active boolean NOT NULL DEFAULT false,
  focus_end_time timestamptz,
  focus_session_id text,
  chat_background_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. messages: multi-user DM columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'sender_id') THEN
    ALTER TABLE messages ADD COLUMN sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'receiver_id') THEN
    ALTER TABLE messages ADD COLUMN receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'location_lat') THEN
    ALTER TABLE messages ADD COLUMN location_lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'location_lng') THEN
    ALTER TABLE messages ADD COLUMN location_lng double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'is_live_location') THEN
    ALTER TABLE messages ADD COLUMN is_live_location boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS messages_dm_pair_idx
  ON messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_attachment_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'video', 'document', 'location'));

-- 3. messages RLS for multi-user DMs
DROP POLICY IF EXISTS "dm_select_own" ON messages;
CREATE POLICY "dm_select_own" ON messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "dm_insert_sender" ON messages;
CREATE POLICY "dm_insert_sender" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "dm_update_sender" ON messages;
CREATE POLICY "dm_update_sender" ON messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "dm_delete_sender" ON messages;
CREATE POLICY "dm_delete_sender" ON messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- 4. handle_new_user trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', 'blue')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. latest_dm_per_partner RPC
CREATE OR REPLACE FUNCTION latest_dm_per_partner(p_user uuid)
RETURNS TABLE (
  partner_id uuid,
  partner_name text,
  partner_avatar_color text,
  partner_focus_active boolean,
  partner_focus_end timestamptz,
  message json
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

-- 6. Add profiles to realtime publication (guarded — no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;

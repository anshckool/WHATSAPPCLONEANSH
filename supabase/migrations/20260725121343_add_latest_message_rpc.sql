/*
# latest_message_per_contact RPC

1. New Functions
- `latest_message_per_contact()` — returns one row per contact that has at least one
  message: the `contact_id` plus the full latest message row serialized as JSON.
  Used by the sidebar to render "last message + time" without fetching every message.
- `DISTINCT ON (contact_id)` ordered by `created_at DESC` ensures one row per contact
  even when two messages share the newest timestamp.

2. Security
- The function runs with the caller's privileges (SECURITY INVOKER default) and the
  messages table has SELECT policies for `anon, authenticated`, so the anon-key
  frontend can call it. Grant EXECUTE to anon + authenticated explicitly.
*/

DROP FUNCTION IF EXISTS latest_message_per_contact();
CREATE OR REPLACE FUNCTION latest_message_per_contact()
RETURNS TABLE (contact_id uuid, message json)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.contact_id)
         m.contact_id,
         to_jsonb(m) AS message
  FROM messages m
  ORDER BY m.contact_id, m.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION latest_message_per_contact() TO anon, authenticated;

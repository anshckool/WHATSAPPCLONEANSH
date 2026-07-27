import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import { localStore } from '@/lib/localStore';
import { useAuth } from '@/hooks/useAuth';
import type {
  AvatarColor,
  Conversation,
  Message,
  MediaType,
  Profile,
} from '@/lib/types';

/** Build the public URL for an object in the chat-media bucket. */
function publicUrl(path: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Minutes remaining until the focus block ends (clamped at 0). */
function focusMinutesRemaining(profile: Profile | null): number {
  if (!profile?.is_focus_mode_active || !profile.focus_end_time) return 0;
  const ms = new Date(profile.focus_end_time).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

/** True when a profile's focus block has technically expired (used to auto-end). */
function focusExpired(profile: Profile | null): boolean {
  if (!profile?.is_focus_mode_active || !profile.focus_end_time) return false;
  return Date.now() >= new Date(profile.focus_end_time).getTime();
}

export function useChat() {
  const { user, mode, refreshProfile } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs so realtime handlers read latest values without re-subscribing.
  const userRef = useRef<Profile | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isSupabase = mode === 'supabase';

  // ---- Profiles (the user roster for the sidebar + "start new chat") -------

  const refreshProfiles = useCallback(async () => {
    if (!user) return;
    setProfilesLoading(true);
    if (isSupabase) {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('name', { ascending: true });
      if (err) {
        setError(err.message);
      } else {
        setProfiles((data ?? []) as Profile[]);
      }
    } else {
      // Local mode: merge the local user roster with seeded demo profiles so a
      // fresh signup still has people to message.
      const local = localStore.listProfiles().filter((p) => p.id !== user.id);
      setProfiles(local);
    }
    setProfilesLoading(false);
  }, [user, isSupabase]);

  // ---- Conversations (sidebar: last message per partner) -------------------

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setConversationsLoading(true);
    if (isSupabase) {
      const { data, error: err } = await supabase.rpc('latest_dm_per_partner', {
        p_user: user.id,
      });
      if (err) {
        setError(err.message);
        setConversationsLoading(false);
        return;
      }
      const rows = (data ?? []) as Array<{
        partner_id: string;
        partner_name: string;
        partner_avatar_color: AvatarColor;
        partner_focus_active: boolean;
        partner_focus_end: string | null;
        message: Message | null;
      }>;
      const enriched: Conversation[] = rows
        .filter((r) => r.partner_id)
        .map((r) => ({
          partner: {
            id: r.partner_id,
            name: r.partner_name,
            avatar_color: r.partner_avatar_color,
            is_focus_mode_active: r.partner_focus_active,
            focus_end_time: r.partner_focus_end,
            focus_session_id: null,
            chat_background_url: null,
            created_at: '',
          } as Profile,
          last_message: r.message,
        }));
      setConversations(enriched);
    } else {
      // Local mode: no conversation persistence yet — show empty until a DM is sent.
      setConversations([]);
    }
    setConversationsLoading(false);
  }, [user, isSupabase]);

  // ---- Messages for a conversation ------------------------------------------

  const loadMessages = useCallback(
    async (partnerId: string) => {
      if (!user) return;
      setMessagesLoading(true);
      if (isSupabase) {
        const { data, error: err } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        if (err) {
          setError(err.message);
        } else {
          setMessages((data ?? []) as Message[]);
        }
      } else {
        setMessages([]);
      }
      setMessagesLoading(false);
    },
    [user, isSupabase],
  );

  const selectPartner = useCallback(
    (partner: Profile) => {
      selectedRef.current = partner.id;
      setSelectedPartner(partner);
      loadMessages(partner.id);
    },
    [loadMessages],
  );

  // ---- Sending --------------------------------------------------------------

  /** Persist a DM and optimistically append it to the open conversation. */
  const persistMessage = useCallback(
    async (partial: Partial<Message> & { content: string | null }): Promise<Message | null> => {
      const me = userRef.current;
      const partnerId = selectedRef.current;
      if (!me || !partnerId) return null;
      if (isSupabase) {
        const { data, error: err } = await supabase
          .from('messages')
          .insert({
            sender_id: me.id,
            receiver_id: partnerId,
            is_from_me: true,
            is_system: false,
            content: partial.content ?? null,
            attachment_type: partial.attachment_type ?? null,
            attachment_url: partial.attachment_url ?? null,
            attachment_name: partial.attachment_name ?? null,
            attachment_size: partial.attachment_size ?? null,
            location_lat: partial.location_lat ?? null,
            location_lng: partial.location_lng ?? null,
            is_live_location: partial.is_live_location ?? false,
          })
          .select('*')
          .single();
        if (err) {
          setError(err.message);
          return null;
        }
        return data as Message;
      }
      // Local mode: synthesize a message object (no persistence beyond session).
      const msg: Message = {
        id: 'local-msg-' + Math.random().toString(36).slice(2),
        contact_id: null,
        sender_id: me.id,
        receiver_id: partnerId,
        is_from_me: true,
        is_system: false,
        content: partial.content ?? null,
        attachment_type: partial.attachment_type ?? null,
        attachment_url: partial.attachment_url ?? null,
        attachment_name: partial.attachment_name ?? null,
        attachment_size: partial.attachment_size ?? null,
        location_lat: partial.location_lat ?? null,
        location_lng: partial.location_lng ?? null,
        is_live_location: partial.is_live_location ?? false,
        created_at: new Date().toISOString(),
      };
      return msg;
    },
    [isSupabase],
  );

  const bumpConversation = useCallback((msg: Message) => {
    setConversations((prev) => {
      const partnerId = msg.receiver_id === userRef.current?.id ? msg.sender_id : msg.receiver_id;
      if (!partnerId) return prev;
      const exists = prev.some((c) => c.partner.id === partnerId);
      const updated = exists
        ? prev.map((c) =>
            c.partner.id === partnerId
              ? { ...c, last_message: msg }
              : c,
          )
        : [
            { partner: { id: partnerId, name: '', avatar_color: 'blue' } as Profile, last_message: msg },
            ...prev,
          ];
      return updated.sort((a, b) => {
        const ta = a.last_message?.created_at ?? '';
        const tb = b.last_message?.created_at ?? '';
        return tb.localeCompare(ta);
      });
    });
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setSending(true);
      const msg = await persistMessage({ content: trimmed });
      setSending(false);
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        bumpConversation(msg);
      }
    },
    [persistMessage, bumpConversation],
  );

  const sendMedia = useCallback(
    async (file: File, kind: MediaType) => {
      const me = userRef.current;
      const partnerId = selectedRef.current;
      if (!me || !partnerId) return;
      setSending(true);
      setError(null);
      const ext = file.name.split('.').pop();
      const path = `${me.id}/${partnerId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}${ext ? '.' + ext : ''}`;
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) {
        setSending(false);
        setError(upErr.message);
        return;
      }
      const url = publicUrl(path);
      const msg = await persistMessage({
        content: null,
        attachment_type: kind,
        attachment_url: url,
        attachment_name: file.name,
        attachment_size: file.size,
      });
      setSending(false);
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        bumpConversation(msg);
      }
    },
    [persistMessage, bumpConversation],
  );

  const sendLocation = useCallback(
    async (lat: number, lng: number, live: boolean) => {
      setSending(true);
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const msg = await persistMessage({
        content: live ? 'Live location sharing' : 'My location',
        attachment_type: 'location',
        attachment_url: mapsUrl,
        attachment_name: `${lat.toFixed(6)},${lng.toFixed(6)}`,
        location_lat: lat,
        location_lng: lng,
        is_live_location: live,
      });
      setSending(false);
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        bumpConversation(msg);
      }
      return msg;
    },
    [persistMessage, bumpConversation],
  );

  /** Update the most recent live-location message in place with a new fix. */
  const updateLiveLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!isSupabase) return;
      const me = userRef.current;
      const partnerId = selectedRef.current;
      if (!me || !partnerId) return;
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      setMessages((prev) =>
        prev.map((m, _i, _arr) =>
          m.is_live_location && m.sender_id === me.id
            ? {
                ...m,
                location_lat: lat,
                location_lng: lng,
                attachment_url: mapsUrl,
                attachment_name: `${lat.toFixed(6)},${lng.toFixed(6)}`,
              }
            : m,
        ),
      );
      const { error: err } = await supabase
        .from('messages')
        .update({
          location_lat: lat,
          location_lng: lng,
          attachment_url: mapsUrl,
          attachment_name: `${lat.toFixed(6)},${lng.toFixed(6)}`,
        })
        .eq('sender_id', me.id)
        .eq('receiver_id', partnerId)
        .eq('is_live_location', true);
      if (err) setError(err.message);
    },
    [isSupabase],
  );

  // ---- Focus Mode -----------------------------------------------------------

  const startFocusMode = useCallback(
    async (minutes: number) => {
      const me = userRef.current;
      if (!me) return;
      const sessionId = `${me.id}-${Date.now()}`;
      const endTime = new Date(Date.now() + minutes * 60000).toISOString();
      const next: Profile = {
        ...me,
        is_focus_mode_active: true,
        focus_end_time: endTime,
        focus_session_id: sessionId,
      };
      userRef.current = next;
      // Optimistic local update via refreshProfile path is heavy; update auth
      // context directly by mutating + re-rendering through state in App.
      if (isSupabase) {
        if (me.focus_session_id) {
          await supabase.from('focus_auto_replies').delete().eq('focus_session_id', me.focus_session_id);
        }
        const { error: err } = await supabase
          .from('profiles')
          .update({
            is_focus_mode_active: true,
            focus_end_time: endTime,
            focus_session_id: sessionId,
          })
          .eq('id', me.id);
        if (err) {
          setError(err.message);
          return;
        }
      } else {
        localStore.updateProfile(me.id, {
          is_focus_mode_active: true,
          focus_end_time: endTime,
          focus_session_id: sessionId,
        });
        localStore.notifyProfilesChanged();
      }
      await refreshProfile();
    },
    [isSupabase, refreshProfile],
  );

  const stopFocusMode = useCallback(async () => {
    const me = userRef.current;
    if (!me) return;
    if (isSupabase) {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          is_focus_mode_active: false,
          focus_end_time: null,
          focus_session_id: null,
        })
        .eq('id', me.id);
      if (err) setError(err.message);
    } else {
      localStore.updateProfile(me.id, {
        is_focus_mode_active: false,
        focus_end_time: null,
        focus_session_id: null,
      });
      localStore.notifyProfilesChanged();
    }
    await refreshProfile();
  }, [isSupabase, refreshProfile]);

  /** Focus auto-reply: when a DM arrives and I'm in focus mode, send a system
   *  notice to that sender — once per session, deduped by the DB constraint. */
  const maybeSendFocusAutoReply = useCallback(
    async (incoming: Message) => {
      const me = userRef.current;
      if (!me?.is_focus_mode_active || !me.focus_session_id) return;
      if (incoming.sender_id === me.id || incoming.is_system) return;
      const remaining = focusMinutesRemaining(me);
      const body = `${me.name} is currently in a deep-work execution block. This focus block ends in ${remaining} minute${remaining === 1 ? '' : 's'}.`;
      if (isSupabase) {
        const { error: ledgerErr } = await supabase
          .from('focus_auto_replies')
          .insert({ focus_session_id: me.focus_session_id, contact_id: incoming.sender_id });
        if (ledgerErr) return; // duplicate — already replied this session
        await supabase.from('messages').insert({
          sender_id: me.id,
          receiver_id: incoming.sender_id,
          is_from_me: true,
          is_system: true,
          content: body,
        });
      }
    },
    [isSupabase],
  );

  // ---- Chat theme (background) ---------------------------------------------

  const setChatBackground = useCallback(
    async (file: File) => {
      const me = userRef.current;
      if (!me) return;
      setError(null);
      const ext = file.name.split('.').pop();
      const path = `backgrounds/${me.id}-${Date.now()}${ext ? '.' + ext : ''}`;
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const url = publicUrl(path);
      if (isSupabase) {
        const { error: err } = await supabase
          .from('profiles')
          .update({ chat_background_url: url })
          .eq('id', me.id);
        if (err) setError(err.message);
      } else {
        localStore.updateProfile(me.id, { chat_background_url: url });
      }
      await refreshProfile();
    },
    [isSupabase, refreshProfile],
  );

  const clearChatBackground = useCallback(async () => {
    const me = userRef.current;
    if (!me) return;
    if (isSupabase) {
      const { error: err } = await supabase
        .from('profiles')
        .update({ chat_background_url: null })
        .eq('id', me.id);
      if (err) setError(err.message);
    } else {
      localStore.updateProfile(me.id, { chat_background_url: null });
    }
    await refreshProfile();
  }, [isSupabase, refreshProfile]);

  // ---- Shared media (for contact profile panel) ----------------------------

  const loadSharedMedia = useCallback(
    async (partnerId: string) => {
      if (!user || !isSupabase) return [];
      const { data, error: err } = await supabase
        .from('messages')
        .select('id, attachment_type, attachment_url, attachment_name, created_at')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .in('attachment_type', ['image', 'video'])
        .not('attachment_url', 'is', null)
        .order('created_at', { ascending: false });
      if (err) return [];
      return (data ?? []) as Array<{
        id: string;
        attachment_type: string;
        attachment_url: string;
        attachment_name: string | null;
        created_at: string;
      }>;
    },
    [user, isSupabase],
  );

  // ---- Initial load ---------------------------------------------------------

  useEffect(() => {
    if (!user) return;
    refreshProfiles();
    refreshConversations();
  }, [user, refreshProfiles, refreshConversations]);

  // Auto-expire focus mode when the timer ends.
  useEffect(() => {
    if (!user?.is_focus_mode_active || !user.focus_end_time) return;
    const endMs = new Date(user.focus_end_time).getTime();
    const tick = () => {
      if (Date.now() >= endMs) stopFocusMode();
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [user?.is_focus_mode_active, user?.focus_end_time, stopFocusMode]);

  // ---- Realtime (Supabase mode) --------------------------------------------

  useEffect(() => {
    if (!isSupabase || !user) return;
    const channel = supabase
      .channel('dm-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          const me = userRef.current;
          if (!me) return;
          // Only care about messages involving me.
          if (msg.sender_id !== me.id && msg.receiver_id !== me.id) return;
          if (msg.contact_id && !msg.sender_id) return; // legacy row
          // If it's in the open conversation, append.
          if (
            (msg.sender_id === selectedRef.current && msg.receiver_id === me.id) ||
            (msg.receiver_id === selectedRef.current && msg.sender_id === me.id)
          ) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
          }
          bumpConversation(msg);
          // Auto-reply if I'm in focus mode and this is an incoming real DM.
          if (msg.receiver_id === me.id && !msg.is_system && msg.sender_id !== me.id) {
            maybeSendFocusAutoReply(msg);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          const me = userRef.current;
          if (!me) return;
          if (
            (msg.sender_id === selectedRef.current && msg.receiver_id === me.id) ||
            (msg.receiver_id === selectedRef.current && msg.sender_id === me.id)
          ) {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          refreshProfiles();
          refreshConversations();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupabase, user, refreshProfiles, refreshConversations, bumpConversation, maybeSendFocusAutoReply]);

  // Local mode: listen for cross-tab profile changes.
  useEffect(() => {
    if (isSupabase || !user) return;
    const handler = () => refreshProfiles();
    window.addEventListener('pulse-local-profiles-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('pulse-local-profiles-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, [isSupabase, user, refreshProfiles]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    user,
    profiles,
    profilesLoading,
    conversations,
    conversationsLoading,
    selectedPartner,
    messages,
    messagesLoading,
    sending,
    error,
    focusMinutesRemaining: focusMinutesRemaining(user),
    focusExpired: focusExpired(user),
    dismissError,
    selectPartner,
    sendText,
    sendMedia,
    sendLocation,
    updateLiveLocation,
    refreshConversations,
    startFocusMode,
    stopFocusMode,
    setChatBackground,
    clearChatBackground,
    loadSharedMedia,
  };
}

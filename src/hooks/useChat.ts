import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import type {
  AppUser,
  AttachmentType,
  Contact,
  Conversation,
  Message,
} from '@/lib/types';

/** Build the public URL for an object in the chat-media bucket. */
function publicUrl(path: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Minutes remaining until the focus block ends (clamped at 0). */
export function focusMinutesRemaining(appUser: AppUser | null): number {
  if (!appUser?.is_focus_mode_active || !appUser.focus_end_time) return 0;
  const ms = new Date(appUser.focus_end_time).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  // Keep a local copy of the selected contact id in a ref so the realtime
  // subscription below can read it without re-subscribing on every selection.
  const selectedRef = useRef<string | null>(null);
  // Latest app user snapshot, readable inside the realtime handler without
  // forcing a re-subscribe on every focus-state change.
  const appUserRef = useRef<AppUser | null>(null);

  const refreshConversations = useCallback(async () => {
    setConversationsLoading(true);
    const { data: contacts, error: err } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true });
    if (err) {
      setError(err.message);
      setConversationsLoading(false);
      return;
    }
    const { data: lastRows, error: lastErr } = await supabase.rpc(
      'latest_message_per_contact',
    );
    const lastByContact = new Map<string, Message>();
    if (!lastErr && lastRows) {
      for (const row of lastRows as Array<{ contact_id: string; message: Message }>) {
        if (row?.message && row.contact_id) {
          lastByContact.set(row.contact_id, row.message);
        }
      }
    }
    const enriched: Conversation[] = (contacts ?? []).map((c) => ({
      ...(c as Contact),
      last_message: lastByContact.get(c.id) ?? null,
    }));
    // Sort so the most recently active conversation is on top.
    enriched.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return tb.localeCompare(ta);
    });
    setConversations(enriched);
    setConversationsLoading(false);
  }, []);

  const loadMessages = useCallback(async (contactId: string) => {
    setMessagesLoading(true);
    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setMessages((data ?? []) as Message[]);
    }
    setMessagesLoading(false);
  }, []);

  const selectContact = useCallback(
    (contact: Contact) => {
      selectedRef.current = contact.id;
      setSelectedContact(contact);
      loadMessages(contact.id);
    },
    [loadMessages],
  );

  const sendText = useCallback(
    async (text: string) => {
      const contactId = selectedRef.current;
      const trimmed = text.trim();
      if (!contactId || !trimmed) return;
      setSending(true);
      const { data, error: err } = await supabase
        .from('messages')
        .insert({
          contact_id: contactId,
          is_from_me: true,
          is_system: false,
          content: trimmed,
        })
        .select('*')
        .single();
      setSending(false);
      if (err) {
        setError(err.message);
        return;
      }
      const msg = data as Message;
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === contactId ? { ...c, last_message: msg } : c,
          )
          .sort((a, b) => {
            const ta = a.last_message?.created_at ?? a.created_at;
            const tb = b.last_message?.created_at ?? b.created_at;
            return tb.localeCompare(ta);
          }),
      );
    },
    [],
  );

  const sendMedia = useCallback(
    async (file: File, kind: AttachmentType) => {
      const contactId = selectedRef.current;
      if (!contactId) return;
      setSending(true);
      setError(null);
      const ext = file.name.split('.').pop();
      const path = `${contactId}/${Date.now()}-${Math.random()
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
      const { data, error: insErr } = await supabase
        .from('messages')
        .insert({
          contact_id: contactId,
          is_from_me: true,
          is_system: false,
          content: null,
          attachment_type: kind,
          attachment_url: url,
          attachment_name: file.name,
          attachment_size: file.size,
        })
        .select('*')
        .single();
      setSending(false);
      if (insErr) {
        setError(insErr.message);
        return;
      }
      const msg = data as Message;
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev
          .map((c) => (c.id === contactId ? { ...c, last_message: msg } : c))
          .sort((a, b) => {
            const ta = a.last_message?.created_at ?? a.created_at;
            const tb = b.last_message?.created_at ?? b.created_at;
            return tb.localeCompare(ta);
          }),
      );
    },
    [],
  );

  // ---- Focus Mode -----------------------------------------------------------

  /** Load the singleton app user row. */
  const loadAppUser = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('app_user')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      const u = data as AppUser;
      appUserRef.current = u;
      setAppUser(u);
    }
  }, []);

  /** Toggle Focus Mode on for a chosen duration (minutes). Generates a fresh
   *  session id so the auto-reply dedup ledger resets for the new block. */
  const startFocusMode = useCallback(async (minutes: number) => {
    const current = appUserRef.current;
    if (!current) return;
    const sessionId = `${current.id}-${Date.now()}`;
    const endTime = new Date(Date.now() + minutes * 60000).toISOString();
    const { error: err } = await supabase
      .from('app_user')
      .update({
        is_focus_mode_active: true,
        focus_end_time: endTime,
        focus_session_id: sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id);
    if (err) {
      setError(err.message);
    }
  }, []);

  /** Turn Focus Mode off (manual end). Clears the end time + session id. */
  const stopFocusMode = useCallback(async () => {
    const current = appUserRef.current;
    if (!current) return;
    const { error: err } = await supabase
      .from('app_user')
      .update({
        is_focus_mode_active: false,
        focus_end_time: null,
        focus_session_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id);
    if (err) {
      setError(err.message);
    }
  }, []);

  /** Emit a Focus Mode auto-reply for a received message. The database-level
   *  UNIQUE(focus_session_id, contact_id) constraint is the dedup guarantee:
   *  the ledger insert is attempted first; only if it succeeds (i.e. this is
   *  the first reply for this sender in this session) do we insert the system
   *  message. Concurrent attempts race safely — the loser's insert is rejected. */
  const maybeSendFocusAutoReply = useCallback(
    async (incoming: Message) => {
      const user = appUserRef.current;
      // Only when focus mode is active, and only for real received messages.
      if (!user?.is_focus_mode_active || !user.focus_session_id) return;
      if (incoming.is_from_me || incoming.is_system) return;

      const remaining = focusMinutesRemaining(user);
      const body = `${user.name} is currently in a deep-work execution block. This focus block ends in ${remaining} minute${remaining === 1 ? '' : 's'}.`;

      // Atomic dedup: insert into the ledger first. The unique constraint makes
      // this succeed exactly once per (session, sender).
      const { error: ledgerErr } = await supabase
        .from('focus_auto_replies')
        .insert({
          focus_session_id: user.focus_session_id,
          contact_id: incoming.contact_id,
        });
      if (ledgerErr) {
        // Duplicate — this sender was already auto-replied this session. Stop.
        return;
      }
      await supabase.from('messages').insert({
        contact_id: incoming.contact_id,
        is_from_me: true,
        is_system: true,
        content: body,
      });
    },
    [],
  );

  // Initial load of the conversation list + app user.
  useEffect(() => {
    refreshConversations();
    loadAppUser();
  }, [refreshConversations, loadAppUser]);

  // Auto-expire Focus Mode when the timer runs out, and keep the countdown
  // driving re-renders every second while active.
  useEffect(() => {
    if (!appUser?.is_focus_mode_active || !appUser.focus_end_time) return;
    const endMs = new Date(appUser.focus_end_time).getTime();
    const tick = () => {
      if (Date.now() >= endMs) {
        stopFocusMode();
      } else {
        // Force a re-render so the countdown updates without polling the DB.
        setAppUser((prev) => (prev ? { ...prev } : prev));
      }
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [appUser?.is_focus_mode_active, appUser?.focus_end_time, stopFocusMode]);

  // Realtime: messages + app_user state changes.
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.contact_id === selectedRef.current) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
          }
          setConversations((prev) =>
            prev
              .map((c) =>
                c.id === msg.contact_id
                  ? {
                      ...c,
                      last_message:
                        c.last_message &&
                        c.last_message.created_at >= msg.created_at
                          ? c.last_message
                          : msg,
                    }
                  : c,
              )
              .sort((a, b) => {
                const ta = a.last_message?.created_at ?? a.created_at;
                const tb = b.last_message?.created_at ?? b.created_at;
                return tb.localeCompare(ta);
              }),
          );
          // Auto-reply engine: if a real message arrives while focus is on,
          // send the system notice (deduped once per sender per session).
          if (!msg.is_from_me && !msg.is_system) {
            maybeSendFocusAutoReply(msg);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_user' },
        (payload) => {
          const u = payload.new as AppUser;
          appUserRef.current = u;
          setAppUser(u);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [maybeSendFocusAutoReply]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    conversations,
    conversationsLoading,
    selectedContact,
    messages,
    messagesLoading,
    sending,
    error,
    appUser,
    focusMinutesRemaining: focusMinutesRemaining(appUser),
    dismissError,
    selectContact,
    sendText,
    sendMedia,
    refreshConversations,
    startFocusMode,
    stopFocusMode,
  };
}

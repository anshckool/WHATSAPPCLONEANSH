import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import type {
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

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a local copy of the selected contact id in a ref so the realtime
  // subscription below can read it without re-subscribing on every selection.
  const selectedRef = useRef<string | null>(null);

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

  // Initial load of the conversation list.
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Realtime: when a new message lands for the selected contact, append it.
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    conversations,
    conversationsLoading,
    selectedContact,
    messages,
    messagesLoading,
    sending,
    error,
    dismissError,
    selectContact,
    sendText,
    sendMedia,
    refreshConversations,
  };
}

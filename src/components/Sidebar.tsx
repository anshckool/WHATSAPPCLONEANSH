import { Focus, Loader2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { avatarTheme, formatRelative } from '@/lib/format';
import type { Conversation, Profile } from '@/lib/types';

interface SidebarProps {
  me: Profile;
  profiles: Profile[];
  profilesLoading: boolean;
  conversations: Conversation[];
  conversationsLoading: boolean;
  selectedId: string | null;
  onSelect: (partner: Profile) => void;
  onStartNewChat: (partner: Profile) => void;
  focusActive: boolean;
  focusMinutesRemaining: number;
}

function lastMessagePreview(convo: Conversation, myId: string): string {
  const m = convo.last_message;
  if (!m) return 'No messages yet';
  const prefix = m.sender_id === myId ? 'You: ' : '';
  if (m.attachment_type === 'image') return `${prefix}Photo`;
  if (m.attachment_type === 'video') return `${prefix}Video`;
  if (m.attachment_type === 'document') return `${prefix}${m.attachment_name ?? 'Document'}`;
  if (m.attachment_type === 'location') return `${prefix}${m.is_live_location ? 'Live location' : 'Location'}`;
  if (m.is_system) return `${prefix}${m.content ?? ''}`;
  return `${prefix}${m.content ?? ''}`;
}

export function Sidebar({
  me,
  profiles,
  profilesLoading,
  conversations,
  conversationsLoading,
  selectedId,
  onSelect,
  onStartNewChat,
  focusActive,
  focusMinutesRemaining,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  // Merge: conversations (with last message) + profiles you haven't talked to yet.
  const conversatedIds = useMemo(
    () => new Set(conversations.map((c) => c.partner.id)),
    [conversations],
  );
  const newChatProfiles = useMemo(
    () =>
      profiles
        .filter((p) => !conversatedIds.has(p.id))
        .filter((p) => {
          const q = query.trim().toLowerCase();
          return !q || p.name.toLowerCase().includes(q);
        }),
    [profiles, conversatedIds, query],
  );

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.partner.name.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <aside className="flex h-full w-full flex-col bg-slate-900">
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
          <span className="text-sm font-bold">P</span>
        </div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-semibold text-slate-100">Pulse</h1>
          <p className="text-xs text-slate-500">Signed in as {me.name}</p>
        </div>
        {focusActive && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold text-purple-300">
            <Focus className="h-3 w-3" />
            <span className="tabular-nums">{focusMinutesRemaining}m left</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or conversations"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* New chat button */}
      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={() => setShowNewChat((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-white"
        >
          <Plus className="h-4 w-4 text-blue-400" />
          New chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {/* Existing conversations */}
        {conversationsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filteredConversations.length === 0 && !showNewChat ? (
          <p className="px-3 py-10 text-center text-sm text-slate-400">
            {query ? 'No conversations match your search.' : 'No conversations yet. Start a new chat!'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredConversations.map((convo) => {
              const active = convo.partner.id === selectedId;
              const theme = avatarTheme(convo.partner.avatar_color);
              const partnerInFocus = convo.partner.is_focus_mode_active;
              return (
                <li key={convo.partner.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(convo.partner)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      active ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'
                    }`}
                  >
                    <Avatar
                      name={convo.partner.name}
                      color={convo.partner.avatar_color}
                      size="md"
                      online={!partnerInFocus}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            active ? 'text-white' : 'text-slate-100'
                          }`}
                        >
                          {convo.partner.name}
                        </span>
                        <span
                          className={`shrink-0 text-[11px] ${
                            active ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {convo.last_message ? formatRelative(convo.last_message.created_at) : ''}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {partnerInFocus && (
                          <span className="flex items-center gap-1 rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
                            <Focus className="h-2.5 w-2.5" />
                            Focus
                          </span>
                        )}
                        <p
                          className={`truncate text-xs ${
                            active ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {lastMessagePreview(convo, me.id)}
                        </p>
                      </div>
                    </div>
                    {active && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${theme.from} ${theme.to}`}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* New chat section: people you haven't talked to yet */}
        {showNewChat && (
          <div className="mt-3">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              People you can message
            </p>
            {profilesLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : newChatProfiles.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {query ? 'No people match your search.' : 'No new people to message.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {newChatProfiles.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onStartNewChat(p);
                          setShowNewChat(false);
                        }}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                          active ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'
                        }`}
                      >
                        <Avatar name={p.name} color={p.avatar_color} size="md" online={!p.is_focus_mode_active} />
                        <div className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm font-semibold ${
                              active ? 'text-white' : 'text-slate-100'
                            }`}
                          >
                            {p.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {p.is_focus_mode_active ? 'In focus mode' : 'Tap to start chatting'}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

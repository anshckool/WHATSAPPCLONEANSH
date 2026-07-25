import { Loader2, Search, MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { avatarTheme, formatRelative } from '@/lib/format';
import type { Conversation } from '@/lib/types';

interface SidebarProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (contact: Conversation) => void;
}

function lastMessagePreview(convo: Conversation): string {
  const m = convo.last_message;
  if (!m) return 'No messages yet';
  const prefix = m.is_from_me ? 'You: ' : '';
  if (m.attachment_type === 'image') return `${prefix}Photo`;
  if (m.attachment_type === 'video') return `${prefix}Video`;
  if (m.attachment_type === 'document')
    return `${prefix}${m.attachment_name ?? 'Document'}`;
  return `${prefix}${m.content ?? ''}`;
}

export function Sidebar({
  conversations,
  loading,
  selectedId,
  onSelect,
}: SidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.username.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <aside className="flex h-full w-full flex-col bg-slate-900">
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-semibold text-slate-100">Pulse</h1>
          <p className="text-xs text-slate-500">Messages</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-400">
            {query ? 'No conversations match your search.' : 'No conversations yet.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((convo) => {
              const active = convo.id === selectedId;
              const theme = avatarTheme(convo.avatar_color);
              return (
                <li key={convo.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(convo)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    <Avatar name={convo.username} color={convo.avatar_color} size="md" online={active} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            active ? 'text-white' : 'text-slate-100'
                          }`}
                        >
                          {convo.username}
                        </span>
                        <span
                          className={`shrink-0 text-[11px] ${
                            active ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {convo.last_message
                            ? formatRelative(convo.last_message.created_at)
                            : ''}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          active ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {lastMessagePreview(convo)}
                      </p>
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
      </div>
    </aside>
  );
}

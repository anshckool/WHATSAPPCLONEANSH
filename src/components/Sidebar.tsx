import { Focus, Loader2, LogOut, MessageSquarePlus, Search, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { avatarTheme, formatRelative } from '@/lib/format';
import type { ContactEntry, Conversation, Profile } from '@/lib/types';

interface SidebarProps {
  me: Profile;
  contacts: ContactEntry[];
  contactsLoading: boolean;
  conversations: Conversation[];
  conversationsLoading: boolean;
  selectedId: string | null;
  onSelect: (partner: Profile) => void;
  onAddContact: () => void;
  onRemoveContact: (contactId: string) => void;
  onSignOut: () => void;
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

/** Merge contacts with conversation data so each row shows last message + time. */
function buildContactRows(
  contacts: ContactEntry[],
  conversations: Conversation[],
  myId: string,
): Array<{
  contact: ContactEntry;
  profile: Profile | null;
  lastMessage: Message | null;
  lastTime: string;
}> {
  const convoMap = new Map(conversations.map((c) => [c.partner.id, c]));
  return contacts
    .map((contact) => {
      const profile = contact.profile;
      const convo = profile ? convoMap.get(profile.id) : undefined;
      const lastMessage = convo?.last_message ?? null;
      const lastTime = lastMessage?.created_at ?? contact.created_at;
      return { contact, profile, lastMessage, lastTime };
    })
    .sort((a, b) => b.lastTime.localeCompare(a.lastTime));
}

export function Sidebar({
  me,
  contacts,
  contactsLoading,
  conversations,
  conversationsLoading,
  selectedId,
  onSelect,
  onAddContact,
  onRemoveContact,
  onSignOut,
  focusActive,
  focusMinutesRemaining,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [menuContactId, setMenuContactId] = useState<string | null>(null);

  const rows = useMemo(
    () => buildContactRows(contacts, conversations, me.id),
    [contacts, conversations, me.id],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.profile?.name ?? r.contact.contact_name ?? '';
      const email = r.contact.contact_email ?? '';
      const phone = r.contact.contact_phone ?? '';
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || phone.toLowerCase().includes(q);
    });
  }, [rows, query]);

  const hasConversations = conversations.length > 0;

  return (
    <aside className="flex h-full w-full flex-col bg-slate-900">
      {/* Brand + user identity header */}
      <div className="border-b border-slate-800 px-5 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <span className="text-sm font-bold">P</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold text-slate-100">Pulse</h1>
            <p className="text-xs text-slate-500">Stay connected</p>
          </div>
          {focusActive && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold text-purple-300">
              <Focus className="h-3 w-3" />
              <span className="tabular-nums">{focusMinutesRemaining}m left</span>
            </div>
          )}
        </div>

        {/* Current user card */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 p-2.5">
          <Avatar name={me.name} color={me.avatar_color} size="sm" online={!focusActive} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-100">{me.name}</p>
            <p className="truncate text-[11px] text-slate-500">{me.email ?? 'No email'}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-400"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search + add contact */}
      <div className="flex gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          />
        </div>
        <button
          type="button"
          onClick={onAddContact}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-blue-400 transition hover:border-blue-500/50 hover:bg-blue-500/10"
          aria-label="Add new contact"
          title="Add new contact"
        >
          <UserPlus className="h-5 w-5" />
        </button>
      </div>

      {/* Contacts / Conversations list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3" onClick={() => setMenuContactId(null)}>
        {contactsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading contacts…</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-slate-500">
              <MessageSquarePlus className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-slate-300">No contacts yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Add people by their email to start chatting.
            </p>
            <button
              type="button"
              onClick={onAddContact}
              className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <UserPlus className="h-4 w-4" />
              Add your first contact
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filteredRows.map(({ contact, profile, lastMessage }) => {
              const contactId = profile?.id ?? contact.id;
              const isActive = profile?.id === selectedId;
              const displayName = profile?.name ?? contact.contact_name ?? contact.contact_email?.split('@')[0] ?? contact.contact_phone ?? 'Unknown';
              const theme = avatarTheme(profile?.avatar_color ?? 'blue');
              const partnerInFocus = profile?.is_focus_mode_active ?? false;
              const registered = !!profile;

              return (
                <li key={contact.id} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (profile) onSelect(profile);
                    }}
                    disabled={!registered}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60'
                    } ${!registered ? 'cursor-default opacity-50' : ''}`}
                  >
                    <Avatar
                      name={displayName}
                      color={profile?.avatar_color ?? 'blue'}
                      size="md"
                      online={registered && !partnerInFocus}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            isActive ? 'text-white' : 'text-slate-100'
                          }`}
                        >
                          {displayName}
                        </span>
                        {lastMessage && (
                          <span
                            className={`shrink-0 text-[11px] ${
                              isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {formatRelative(lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {partnerInFocus && (
                          <span className="flex items-center gap-1 rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
                            <Focus className="h-2.5 w-2.5" />
                            Focus
                          </span>
                        )}
                        {!registered && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                            Not registered
                          </span>
                        )}
                        {lastMessage ? (
                          <p
                            className={`truncate text-xs ${
                              isActive ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {lastMessagePreview({ partner: profile!, last_message: lastMessage }, me.id)}
                          </p>
                        ) : (
                          <p className="truncate text-xs text-slate-500">
                            {registered ? 'Tap to start chatting' : (contact.contact_phone ?? contact.contact_email)}
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${theme.from} ${theme.to}`}
                      />
                    )}
                  </button>

                  {/* Remove contact button — appears on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuContactId === contact.id) {
                        onRemoveContact(contact.id);
                        setMenuContactId(null);
                      } else {
                        setMenuContactId(contact.id);
                      }
                    }}
                    className={`absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition ${
                      menuContactId === contact.id
                        ? 'bg-rose-500/20 text-rose-400 opacity-100'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-slate-700'
                    }`}
                    aria-label="Remove contact"
                    title="Remove contact"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Confirm removal tooltip */}
                  {menuContactId === contact.id && (
                    <div className="absolute right-9 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
                      Click again to remove
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

// Need to import Message type for the buildContactRows helper
import type { Message } from '@/lib/types';

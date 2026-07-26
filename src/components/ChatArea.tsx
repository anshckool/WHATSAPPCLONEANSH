import { useEffect, useRef, useState } from 'react';
import { Info, Loader2, Phone, Video } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ContactProfile } from '@/components/ContactProfile';
import type { SharedMediaItem } from '@/components/ContactProfile';
import { FocusModeToggle } from '@/components/FocusModeToggle';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageComposer } from '@/components/MessageComposer';
import { ThemeButton } from '@/components/ThemeButton';
import { formatDateDivider } from '@/lib/format';
import type { AttachmentType, Contact, Message } from '@/lib/types';

interface ChatAreaProps {
  contact: Contact;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  onSendText: (text: string) => void;
  onSendMedia: (file: File, kind: AttachmentType) => void;
  focusActive: boolean;
  focusMinutesRemaining: number;
  onStartFocus: (minutes: number) => void;
  onStopFocus: () => void;
  chatBackgroundUrl: string | null;
  onSetBackground: (file: File) => void;
  onClearBackground: () => void;
  onLoadMedia: (contactId: string) => Promise<SharedMediaItem[]>;
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-400 shadow-sm backdrop-blur">
        {label}
      </span>
    </div>
  );
}

export function ChatArea({
  contact,
  messages,
  loading,
  sending,
  onSendText,
  onSendMedia,
  focusActive,
  focusMinutesRemaining,
  onStartFocus,
  onStopFocus,
  chatBackgroundUrl,
  onSetBackground,
  onClearBackground,
  onLoadMedia,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Group messages by day for date dividers.
  let lastDate = '';

  return (
    <section className="relative flex h-full flex-col bg-slate-950">
      {/* Optional background image, dimmed behind the messages */}
      {chatBackgroundUrl && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${chatBackgroundUrl})` }}
          aria-hidden
        />
      )}
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Avatar name={contact.username} color={contact.avatar_color} size="md" online />
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="leading-tight text-left transition hover:opacity-80"
            aria-label={`View ${contact.username}'s profile`}
          >
            <h2 className="text-sm font-semibold text-slate-100">{contact.username}</h2>
            <p className="text-xs text-emerald-400">Active now</p>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <FocusModeToggle
            active={focusActive}
            minutesRemaining={focusMinutesRemaining}
            onStart={onStartFocus}
            onStop={onStopFocus}
          />
          <ThemeButton
            backgroundUrl={chatBackgroundUrl}
            onSet={onSetBackground}
            onClear={onClearBackground}
          />
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Contact info"
          >
            <Info className="h-5 w-5" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200" aria-label="Call">
            <Phone className="h-5 w-5" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200" aria-label="Video call">
            <Video className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading conversation…</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">
              No messages yet. Say hello to {contact.username}.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
            {messages.map((m) => {
              const day = formatDateDivider(m.created_at);
              const showDivider = day !== lastDate;
              lastDate = day;
              return (
                <div key={m.id}>
                  {showDivider && <DateDivider label={day} />}
                  <MessageBubble message={m} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer
        onSendText={onSendText}
        onSendMedia={onSendMedia}
        disabled={sending}
        sending={sending}
      />

      <ContactProfile
        contact={contact}
        messageCount={messages.length}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLoadMedia={onLoadMedia}
      />
    </section>
  );
}

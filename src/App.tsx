import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ChatArea } from '@/components/ChatArea';
import { EmptyState } from '@/components/EmptyState';
import { Sidebar } from '@/components/Sidebar';
import { useChat } from '@/hooks/useChat';
import { ArrowLeft } from 'lucide-react';

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-rose-600 px-4 py-3 text-sm text-white shadow-xl animate-[fadeInUp_0.2s_ease-out]">
      <span>{message}</span>
      <button onClick={onClose} className="opacity-70 transition hover:opacity-100" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function App() {
  const {
    conversations,
    conversationsLoading,
    selectedContact,
    messages,
    messagesLoading,
    sending,
    error,
    appUser,
    focusMinutesRemaining,
    dismissError,
    selectContact,
    sendText,
    sendMedia,
    startFocusMode,
    stopFocusMode,
  } = useChat();

  // On mobile, toggle between the sidebar and the chat view.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const handleSelect = (contact: typeof selectedContact) => {
    if (contact) {
      selectContact(contact);
      setMobileView('chat');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      {/* Sidebar — full width on desktop, toggled on mobile */}
      <div
        className={`${
          mobileView === 'list' ? 'block' : 'hidden'
        } w-full shrink-0 border-r border-slate-800 md:block md:w-[340px] lg:w-[380px]`}
      >
        <Sidebar
          conversations={conversations}
          loading={conversationsLoading}
          selectedId={selectedContact?.id ?? null}
          onSelect={handleSelect}
          focusActive={!!appUser?.is_focus_mode_active}
          focusMinutesRemaining={focusMinutesRemaining}
        />
      </div>

      {/* Chat area */}
      <div
        className={`${
          mobileView === 'chat' ? 'block' : 'hidden'
        } relative flex-1 md:block`}
      >
        {/* Back button (mobile only) */}
        {selectedContact && (
          <button
            onClick={() => setMobileView('list')}
            className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 shadow-sm transition hover:bg-slate-700 md:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {selectedContact ? (
          <ChatArea
            contact={selectedContact}
            messages={messages}
            loading={messagesLoading}
            sending={sending}
            onSendText={sendText}
            onSendMedia={sendMedia}
            focusActive={!!appUser?.is_focus_mode_active}
            focusMinutesRemaining={focusMinutesRemaining}
            onStartFocus={startFocusMode}
            onStopFocus={stopFocusMode}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {error && <ErrorToast message={error} onClose={dismissError} />}
    </div>
  );
}

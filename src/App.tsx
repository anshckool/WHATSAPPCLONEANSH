import { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { AddContactModal } from '@/components/AddContactModal';
import { AuthModal } from '@/components/AuthModal';
import { ChatArea } from '@/components/ChatArea';
import { EmptyState } from '@/components/EmptyState';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';

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

function ChatApp() {
  const { user, loading, signOut } = useAuth();
  const {
    contacts,
    contactsLoading,
    conversations,
    conversationsLoading,
    selectedPartner,
    messages,
    messagesLoading,
    sending,
    error,
    focusMinutesRemaining,
    dismissError,
    selectPartner,
    sendText,
    sendMedia,
    sendLocation,
    updateLiveLocation,
    startFocusMode,
    stopFocusMode,
    setChatBackground,
    clearChatBackground,
    loadSharedMedia,
    addContactByEmail,
    removeContact,
  } = useChat();

  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [addContactOpen, setAddContactOpen] = useState(false);

  useEffect(() => {
    setMobileView('list');
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  const handleSelect = (partner: typeof selectedPartner) => {
    if (partner) {
      selectPartner(partner);
      setMobileView('chat');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      {/* Sidebar */}
      <div
        className={`${
          mobileView === 'list' ? 'block' : 'hidden'
        } w-full shrink-0 border-r border-slate-800 md:block md:w-[340px] lg:w-[380px]`}
      >
        <Sidebar
          me={user}
          contacts={contacts}
          contactsLoading={contactsLoading}
          conversations={conversations}
          conversationsLoading={conversationsLoading}
          selectedId={selectedPartner?.id ?? null}
          onSelect={handleSelect}
          onAddContact={() => setAddContactOpen(true)}
          onRemoveContact={removeContact}
          onSignOut={signOut}
          focusActive={!!user.is_focus_mode_active}
          focusMinutesRemaining={focusMinutesRemaining}
        />
      </div>

      {/* Chat area */}
      <div
        className={`${
          mobileView === 'chat' ? 'block' : 'hidden'
        } relative flex-1 md:block`}
      >
        {selectedPartner && (
          <button
            onClick={() => setMobileView('list')}
            className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 shadow-sm transition hover:bg-slate-700 md:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {selectedPartner ? (
          <ChatArea
            me={user}
            partner={selectedPartner}
            messages={messages}
            loading={messagesLoading}
            sending={sending}
            onSendText={sendText}
            onSendMedia={sendMedia}
            onSendLocation={sendLocation}
            onUpdateLiveLocation={updateLiveLocation}
            focusActive={!!user.is_focus_mode_active}
            focusMinutesRemaining={focusMinutesRemaining}
            onStartFocus={startFocusMode}
            onStopFocus={stopFocusMode}
            chatBackgroundUrl={user.chat_background_url ?? null}
            onSetBackground={setChatBackground}
            onClearBackground={clearChatBackground}
            onLoadMedia={loadSharedMedia}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Add contact modal */}
      <AddContactModal
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        onAdd={addContactByEmail}
      />

      {error && <ErrorToast message={error} onClose={dismissError} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatApp />
    </AuthProvider>
  );
}

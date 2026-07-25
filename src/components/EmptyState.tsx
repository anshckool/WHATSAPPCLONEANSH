import { MessageSquare } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
        <MessageSquare className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-100">Your messages</h2>
      <p className="mt-1.5 max-w-sm text-sm text-slate-400">
        Select a conversation from the left to start chatting. You can share
        photos, videos, and documents too.
      </p>
    </div>
  );
}

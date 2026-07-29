import { useState } from 'react';
import { Loader2, Mail, UserPlus, X } from 'lucide-react';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (email: string) => Promise<{ ok: boolean; error?: string }>;
}

export function AddContactModal({ open, onClose, onAdd }: AddContactModalProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(false);
    setBusy(true);
    const result = await onAdd(email);
    setBusy(false);
    if (result.ok) {
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } else {
      setErr(result.error ?? 'Could not add contact.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">Add a contact</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          Enter the email of someone who has registered on Pulse. Once added, you
          can start chatting with them right away.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
              Contact added successfully!
            </div>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add contact
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

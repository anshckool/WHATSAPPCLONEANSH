import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Mail, Phone, UserPlus, X } from 'lucide-react';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onAddByEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  onAddByPhone: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  myEmail: string | null;
}

type Tab = 'email' | 'phone' | 'invite';

export function AddContactModal({ open, onClose, onAddByEmail, onAddByPhone, myEmail }: AddContactModalProps) {
  const [tab, setTab] = useState<Tab>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const inviteUrl = myEmail
    ? `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(myEmail)}`
    : '';

  const reset = () => {
    setErr(null);
    setSuccess(false);
    setEmail('');
    setPhone('');
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(false);
    setBusy(true);
    const result = await onAddByEmail(email);
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

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(false);
    setBusy(true);
    const result = await onAddByPhone(phone);
    setBusy(false);
    if (result.ok) {
      setSuccess(true);
      setPhone('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } else {
      setErr(result.error ?? 'Could not add contact.');
    }
  };

  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = inviteUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Mail }> = [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'phone', label: 'Phone', icon: Phone },
    { key: 'invite', label: 'Invite link', icon: Link2 },
  ];

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

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl bg-slate-800/60 p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); reset(); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                tab === key ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Email tab */}
        {tab === 'email' && (
          <form onSubmit={submitEmail} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter the email of someone who has registered on Pulse. Once added, you can start chatting right away.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email address</label>
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
            {err && <ErrorRow message={err} />}
            {success && <SuccessRow message="Contact added successfully!" />}
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={busy} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Add contact
              </button>
            </div>
          </form>
        )}

        {/* Phone tab */}
        {tab === 'phone' && (
          <form onSubmit={submitPhone} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter a phone number to add them to your contacts. If they've registered on Pulse, you can start texting over the internet right away — just like your phone's messaging app.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Include country code (e.g. +1 for US).</p>
            </div>
            {err && <ErrorRow message={err} />}
            {success && <SuccessRow message="Contact added successfully!" />}
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={busy} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Add contact
              </button>
            </div>
          </form>
        )}

        {/* Invite link tab */}
        {tab === 'invite' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Share this link with anyone. When they open it and sign in, you'll both be added to each other's contacts automatically.
            </p>
            {myEmail ? (
              <>
                <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                  <p className="mb-2 text-xs font-medium text-slate-400">Your invite link</p>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-xs text-blue-300">
                      {inviteUrl}
                    </div>
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${
                        copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                      aria-label="Copy invite link"
                      title="Copy invite link"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {copied && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                    <Check className="h-4 w-4" />
                    <span>Link copied to clipboard! Share it with anyone you want to chat with.</span>
                  </div>
                )}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-3 text-xs text-slate-500">
                  <p className="font-medium text-slate-400">How it works</p>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                    <li>Copy the link above and send it to a friend.</li>
                    <li>They open it, sign up or sign in, and Pulse connects you both.</li>
                    <li>You'll see each other in your contact lists instantly.</li>
                  </ol>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
                Your account doesn't have an email on file, so we can't generate an invite link.
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
      <X className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SuccessRow({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
      {message}
    </div>
  );
}

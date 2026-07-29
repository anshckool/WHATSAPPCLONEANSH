import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AVATAR_COLORS, type AvatarColor } from '@/lib/types';
import { avatarTheme, initialOf } from '@/lib/format';

const PREVIEW_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function AuthModal() {
  const { signUp, signIn, mode } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState<AvatarColor>('blue');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setErr(null), [tab]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (tab === 'signup') {
        if (!name.trim()) throw new Error('Please enter your name.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await signUp(name.trim(), email.trim(), password, color);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Pulse</h1>
            <p className="text-xs text-slate-500">
              {mode === 'local' ? 'Local multi-user mode' : 'Sign in to chat'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
          {(['signup', 'signin'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                tab === t
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {tab === 'signup' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            />
          </div>

          {tab === 'signup' && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">
                Pick your avatar
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c, i) => {
                  const theme = avatarTheme(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={`Avatar color ${c}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${theme.from} ${theme.to} text-sm font-semibold text-white transition ${
                        color === c
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {PREVIEW_NAMES[i]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <span>{err}</span>
                {err.includes('already exists') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('signin');
                      setErr(null);
                    }}
                    className="mt-1 block font-semibold text-rose-200 underline-offset-2 hover:underline"
                  >
                    Switch to Sign In
                  </button>
                )}
                {err.includes('Wrong email or password') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('signup');
                      setErr(null);
                    }}
                    className="mt-1 block font-semibold text-rose-200 underline-offset-2 hover:underline"
                  >
                    Create a new account
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {tab === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          {tab === 'signup' ? (
            <>
              Already have an account?{' '}
              <button onClick={() => setTab('signin')} className="font-medium text-blue-400 hover:underline">
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{' '}
              <button onClick={() => setTab('signup')} className="font-medium text-blue-400 hover:underline">
                Create an account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// Re-exported helper used by the sidebar avatar preview elsewhere
export { initialOf };

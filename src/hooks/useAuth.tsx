import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { localStore } from '@/lib/localStore';
import type { AvatarColor, Profile } from '@/lib/types';

type AuthMode = 'supabase' | 'local' | 'unknown';

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  mode: AuthMode;
  signUp: (name: string, email: string, password: string, avatarColor: AvatarColor, phone?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** True when an error message looks like a network/transport failure rather
 *  than a legitimate auth rejection (bad credentials, already registered, etc.). */
function isNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to') ||
    m.includes('timeout') ||
    m.includes('connection') ||
    m.includes('refused')
  );
}

/** True when the error indicates the email is already registered. */
function isAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('already') || m.includes('has been taken') || m.includes('user already');
}

/** True when the error indicates the credentials are wrong / user not found. */
function isInvalidCredentials(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('invalid') ||
    m.includes('incorrect') ||
    m.includes('not found') ||
    m.includes('bad password') ||
    m.includes('invalid login')
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>('unknown');

  const loadSupabaseProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return null;
    return data as Profile;
  }, []);

  // Bootstrap: detect mode + restore session. We always start by trying
  // Supabase (getSession reads local storage, not the network), then let
  // signUp/signIn fall back to local mode if the server is unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMode('supabase');

      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const profile = await loadSupabaseProfile(data.session.user.id);
          if (!cancelled && profile) setUser(profile);
        }
      } catch {
        // Supabase client threw — switch to local and try the stored session.
        setMode('local');
        const local = localStore.getSession();
        if (!cancelled && local) setUser(local);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSupabaseProfile]);

  // Supabase auth state listener — keeps the profile in sync when the session
  // changes (e.g. sign out in another tab).
  useEffect(() => {
    if (mode !== 'supabase') return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const profile = await loadSupabaseProfile(session.user.id);
          if (profile) setUser(profile);
        } else {
          // Only null out if we're not in local mode (local session is
          // managed by localStore, not the Supabase listener).
          const local = localStore.getSession();
          if (!local) setUser(null);
        }
      })();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [mode, loadSupabaseProfile]);

  const signUp = useCallback(
    async (name: string, email: string, password: string, avatarColor: AvatarColor, phone?: string) => {
      if (mode === 'supabase') {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, avatar_color: avatarColor, phone: phone || undefined } },
          });

          if (error) {
            // "Already registered" on Supabase. Instead of trapping the user,
            // fall back to local mode and force-overwrite the local account
            // with the password they just typed. This breaks the auth loop:
            // even if the Supabase password is wrong/corrupted, the user can
            // now sign in locally with the credentials they just entered.
            if (isAlreadyRegistered(error.message)) {
              setMode('local');
              localStore.upsert(name, email, password, avatarColor, phone);
              localStore.notifyProfilesChanged();
              setUser(localStore.getSession());
              return;
            }
            // Network/transport error → fall back to local mode.
            if (isNetworkError(error.message)) {
              setMode('local');
              localStore.signUp(name, email, password, avatarColor, phone);
              localStore.notifyProfilesChanged();
              setUser(localStore.getSession());
              return;
            }
            // Any other Supabase error → throw it (rate limit, weak password).
            throw error;
          }

          // signUp succeeded. If we got a session, load the profile.
          if (data.session && data.user) {
            let profile: Profile | null = null;
            for (let i = 0; i < 6 && !profile; i++) {
              profile = await loadSupabaseProfile(data.user.id);
              if (!profile) await new Promise((r) => setTimeout(r, 200));
            }
            if (profile) {
              setUser(profile);
              return;
            }
          }

          // No session — email confirmation may be on. Try signing in
          // immediately with the same credentials.
          if (data.user && !data.session) {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (!signInErr) {
              const profile = await loadSupabaseProfile(data.user.id);
              if (profile) {
                setUser(profile);
                return;
              }
            }
          }

          // Ultimate fallback: local mode.
          setMode('local');
          localStore.signUp(name, email, password, avatarColor, phone);
          localStore.notifyProfilesChanged();
          setUser(localStore.getSession());
        } catch (e) {
          // Network/transport exception → fall back to local mode.
          if (e instanceof Error && isNetworkError(e.message)) {
            setMode('local');
            localStore.signUp(name, email, password, avatarColor, phone);
            localStore.notifyProfilesChanged();
            setUser(localStore.getSession());
            return;
          }
          // Re-throw genuine validation errors (weak password, etc.).
          throw e;
        }
      } else {
        localStore.signUp(name, email, password, avatarColor, phone);
        localStore.notifyProfilesChanged();
        setUser(localStore.getSession());
      }
    },
    [mode, loadSupabaseProfile],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (mode === 'supabase') {
        let supabaseFailed = false;
        let supabaseErr: string | null = null;
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            supabaseFailed = true;
            supabaseErr = error.message;
            // Network/transport error → fall back to local mode immediately.
            if (isNetworkError(error.message)) {
              setMode('local');
              localStore.signIn(email, password);
              setUser(localStore.getSession());
              return;
            }
            // Credential error (wrong password, user not found). Don't throw
            // yet — try local mode first so users who registered via the
            // local fallback can still sign in.
          } else if (data.user) {
            const profile = await loadSupabaseProfile(data.user.id);
            if (profile) {
              setUser(profile);
              return;
            }
            supabaseFailed = true;
          }
        } catch (e) {
          supabaseFailed = true;
          supabaseErr = e instanceof Error ? e.message : 'Sign in failed.';
          if (e instanceof Error && isNetworkError(e.message)) {
            setMode('local');
            localStore.signIn(email, password);
            setUser(localStore.getSession());
            return;
          }
        }

        // Supabase sign-in didn't produce a profile. Try local mode — the user
        // may have registered through the local fallback, or their local
        // password differs from the (possibly corrupted) Supabase one.
        if (supabaseFailed) {
          try {
            setMode('local');
            localStore.signIn(email, password);
            setUser(localStore.getSession());
            return;
          } catch {
            // Local sign-in also failed — restore mode and surface the
            // original Supabase error so the user knows what went wrong.
            setMode('supabase');
            throw new Error(
              supabaseErr && isInvalidCredentials(supabaseErr)
                ? 'Wrong email or password. Double-check your credentials, or create a new account.'
                : supabaseErr ?? 'Sign in failed. Please try again.',
            );
          }
        }
      } else {
        localStore.signIn(email, password);
        setUser(localStore.getSession());
      }
    },
    [mode, loadSupabaseProfile],
  );

  const signOut = useCallback(async () => {
    if (mode === 'supabase') {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore — we're signing out locally anyway.
      }
    }
    localStore.signOut();
    setUser(null);
  }, [mode]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    if (mode === 'supabase') {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const profile = await loadSupabaseProfile(data.session.user.id);
        if (profile) setUser(profile);
      }
    } else {
      const local = localStore.getSession();
      if (local) setUser(local);
    }
  }, [user, mode, loadSupabaseProfile]);

  const value = useMemo(
    () => ({ user, loading, mode, signUp, signIn, signOut, refreshProfile }),
    [user, loading, mode, signUp, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

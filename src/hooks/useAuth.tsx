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
  signUp: (name: string, email: string, password: string, avatarColor: AvatarColor) => Promise<void>;
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
      const detected = 'supabase';
      if (cancelled) return;
      setMode(detected);

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
    async (name: string, email: string, password: string, avatarColor: AvatarColor) => {
      if (mode === 'supabase') {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, avatar_color: avatarColor } },
          });

          if (error) {
            // "Already registered" is a legitimate error — don't fall back,
            // tell the user to sign in instead.
            if (isAlreadyRegistered(error.message)) {
              throw new Error('An account with this email already exists. Try signing in instead.');
            }
            // Network/transport error → fall back to local mode so sign-up
            // always works.
            if (isNetworkError(error.message)) {
              setMode('local');
              localStore.signUp(name, email, password, avatarColor);
              localStore.notifyProfilesChanged();
              setUser(localStore.getSession());
              return;
            }
            // Any other Supabase error → throw it (rate limit, weak password, etc.)
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
            // signIn failed — fall back to local so the user can still use the app.
          }

          // Ultimate fallback: local mode.
          setMode('local');
          localStore.signUp(name, email, password, avatarColor);
          localStore.notifyProfilesChanged();
          setUser(localStore.getSession());
        } catch (e) {
          // If this is our own thrown error (already registered), re-throw.
          if (e instanceof Error && isAlreadyRegistered(e.message)) throw e;
          // Network/transport exception → fall back to local mode.
          setMode('local');
          localStore.signUp(name, email, password, avatarColor);
          localStore.notifyProfilesChanged();
          setUser(localStore.getSession());
        }
      } else {
        localStore.signUp(name, email, password, avatarColor);
        localStore.notifyProfilesChanged();
        setUser(localStore.getSession());
      }
    },
    [mode, loadSupabaseProfile],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (mode === 'supabase') {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            // Network/transport error → fall back to local mode.
            if (isNetworkError(error.message)) {
              setMode('local');
              localStore.signIn(email, password);
              setUser(localStore.getSession());
              return;
            }
            // Credential error (wrong password, user not found) → throw it.
            throw error;
          }
          if (data.user) {
            const profile = await loadSupabaseProfile(data.user.id);
            if (profile) {
              setUser(profile);
              return;
            }
          }
          // No profile found — fall back to local.
          setMode('local');
          localStore.signIn(email, password);
          setUser(localStore.getSession());
        } catch (e) {
          // Re-throw credential errors (our own throws or Supabase auth errors).
          if (e instanceof Error && !isNetworkError(e.message)) throw e;
          // Network exception → fall back to local mode.
          setMode('local');
          localStore.signIn(email, password);
          setUser(localStore.getSession());
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

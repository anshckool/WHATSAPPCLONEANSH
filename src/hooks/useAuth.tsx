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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>('unknown');

  // Probe whether Supabase auth is usable. We attempt a lightweight getSession;
  // if it resolves, we treat Supabase as the auth backend. If it throws or the
  // client errors out, we fall back to the localStorage session.
  const detectMode = useCallback(async (): Promise<AuthMode> => {
    try {
      const { error } = await supabase.auth.getSession();
      if (error) return 'local';
      return 'supabase';
    } catch {
      return 'local';
    }
  }, []);

  const loadSupabaseProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return null;
    return data as Profile;
  }, []);

  // Bootstrap: detect mode + restore session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await detectMode();
      if (cancelled) return;
      setMode(detected);

      if (detected === 'supabase') {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const profile = await loadSupabaseProfile(data.session.user.id);
          if (!cancelled && profile) setUser(profile);
        }
      } else {
        const local = localStore.getSession();
        if (!cancelled && local) setUser(local);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [detectMode, loadSupabaseProfile]);

  // Supabase auth state listener (only acts in supabase mode).
  useEffect(() => {
    if (mode !== 'supabase') return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Avoid the deadlock documented in the database skill: wrap async work.
      (async () => {
        if (session?.user) {
          const profile = await loadSupabaseProfile(session.user.id);
          if (profile) setUser(profile);
        } else {
          setUser(null);
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, avatar_color: avatarColor } },
        });
        if (error) throw error;
        // The handle_new_user trigger creates the profile row. Fetch it.
        if (data.user) {
          // Profile may take a tick to appear after the trigger; retry briefly.
          let profile: Profile | null = null;
          for (let i = 0; i < 5 && !profile; i++) {
            profile = await loadSupabaseProfile(data.user.id);
            if (!profile) await new Promise((r) => setTimeout(r, 150));
          }
          if (profile) setUser(profile);
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const profile = await loadSupabaseProfile(data.user.id);
          if (profile) setUser(profile);
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
      await supabase.auth.signOut();
    } else {
      localStore.signOut();
    }
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

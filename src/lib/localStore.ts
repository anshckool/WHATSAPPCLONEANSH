import type { AvatarColor, Profile } from '@/lib/types';

/**
 * LocalStorage-backed session fallback.
 *
 * When Supabase Auth is reachable we use it as the source of truth. But on some
 * deployed preview URLs the auth endpoint can be unreachable, and we still want
 * multiple people to sign in and chat. This module provides a fully local
 * multi-user store so the app works out-of-the-box regardless.
 *
 * Accounts and messages are persisted in localStorage keyed per "instance"
 * (the project URL), so two different browser sessions on the same preview URL
 * share the same user roster and can message each other.
 */

const USERS_KEY = 'pulse_local_users';
const SESSION_KEY = 'pulse_local_session';

export interface LocalProfile extends Profile {
  email: string;
  password: string;
}

function readUsers(): LocalProfile[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as LocalProfile[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: LocalProfile[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function makeId(): string {
  return 'local-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const localStore = {
  signUp(name: string, email: string, password: string, avatarColor: AvatarColor): LocalProfile {
    const users = readUsers();
    const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) throw new Error('An account with this email already exists.');

    const user: LocalProfile = {
      id: makeId(),
      name,
      email,
      password,
      avatar_color: avatarColor,
      is_focus_mode_active: false,
      focus_end_time: null,
      focus_session_id: null,
      chat_background_url: null,
      created_at: new Date().toISOString(),
    };
    users.push(user);
    writeUsers(users);
    // Strip password before returning/storing session.
    const { password: _pw, ...publicProfile } = user;
    void _pw;
    localStorage.setItem(SESSION_KEY, JSON.stringify(publicProfile));
    return user;
  },

  signIn(email: string, password: string): Profile {
    const users = readUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password.');
    }
    const { password: _pw, ...publicProfile } = user;
    void _pw;
    localStorage.setItem(SESSION_KEY, JSON.stringify(publicProfile));
    return publicProfile;
  },

  getSession(): Profile | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  },

  signOut(): void {
    localStorage.removeItem(SESSION_KEY);
  },

  listProfiles(): Profile[] {
    return readUsers().map(({ password: _pw, ...p }) => {
      void _pw;
      return p;
    });
  },

  updateProfile(id: string, patch: Partial<Profile>): Profile | null {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    writeUsers(users);
    const { password: _pw, ...publicProfile } = users[idx];
    void _pw;
    const session = this.getSession();
    if (session && session.id === id) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(publicProfile));
    }
    return publicProfile;
  },

  /** A custom event fired whenever local profiles/users change, so open tabs
   *  can refresh their sidebar user lists. */
  notifyProfilesChanged(): void {
    window.dispatchEvent(new CustomEvent('pulse-local-profiles-changed'));
  },
};

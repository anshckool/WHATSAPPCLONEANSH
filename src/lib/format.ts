/** "10:24 AM" — used inside the chat bubbles. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Relative label for the sidebar: time today, weekday if this week, else date. */
export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
}

/** "Today" / "Yesterday" / weekday / full date — for date dividers in the chat. */
export function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (Math.floor((now.getTime() - d.getTime()) / 86400000) < 7) {
    return d.toLocaleDateString([], { weekday: 'long' });
  }
  return d.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Human-readable file size, e.g. "1.8 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** First letter of a username, uppercased, for the initials avatar. */
export function initialOf(username: string): string {
  return username.trim().charAt(0).toUpperCase() || '?';
}

export const AVATAR_GRADIENTS: Record<
  string,
  { from: string; to: string; ring: string }
> = {
  amber: { from: 'from-amber-400', to: 'to-orange-500', ring: 'ring-amber-400/40' },
  rose: { from: 'from-rose-400', to: 'to-pink-500', ring: 'ring-rose-400/40' },
  emerald: { from: 'from-emerald-400', to: 'to-teal-500', ring: 'ring-emerald-400/40' },
  sky: { from: 'from-sky-400', to: 'to-blue-500', ring: 'ring-sky-400/40' },
  violet: { from: 'from-violet-400', to: 'to-purple-500', ring: 'ring-violet-400/40' },
  blue: { from: 'from-blue-400', to: 'to-indigo-500', ring: 'ring-blue-400/40' },
};

export function avatarTheme(color: string) {
  return AVATAR_GRADIENTS[color] ?? AVATAR_GRADIENTS.blue;
}

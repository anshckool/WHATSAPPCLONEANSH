export type AvatarColor =
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'blue';

export const AVATAR_COLORS: AvatarColor[] = [
  'amber',
  'rose',
  'emerald',
  'sky',
  'violet',
  'blue',
];

export type AttachmentType = 'image' | 'video' | 'document' | 'location';

/** Media attachments that go through the file picker (location has its own path). */
export type MediaType = 'image' | 'video' | 'document';

/** A registered user's profile. `id` matches their Supabase Auth user id. */
export interface Profile {
  id: string;
  name: string;
  avatar_color: AvatarColor;
  is_focus_mode_active: boolean;
  focus_end_time: string | null;
  focus_session_id: string | null;
  chat_background_url: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  contact_id: string | null;
  sender_id: string | null;
  receiver_id: string | null;
  is_from_me: boolean;
  is_system: boolean;
  content: string | null;
  attachment_type: AttachmentType | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  location_lat: number | null;
  location_lng: number | null;
  is_live_location: boolean;
  created_at: string;
}

/** A conversation partner + their most recent message, for the sidebar. */
export interface Conversation {
  partner: Profile;
  last_message: Message | null;
}

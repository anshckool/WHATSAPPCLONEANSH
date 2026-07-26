export type AvatarColor =
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'blue';

export interface Contact {
  id: string;
  username: string;
  avatar_color: AvatarColor;
  created_at: string;
}

export type AttachmentType = 'image' | 'video' | 'document';

export interface Message {
  id: string;
  contact_id: string;
  is_from_me: boolean;
  is_system: boolean;
  content: string | null;
  attachment_type: AttachmentType | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
}

/** Contact enriched with its most recent message, used to render the sidebar. */
export interface Conversation extends Contact {
  last_message: Message | null;
}

/** Singleton row representing the app user (Ansh) and their Focus Mode state. */
export interface AppUser {
  id: string;
  name: string;
  is_focus_mode_active: boolean;
  focus_end_time: string | null;
  focus_session_id: string | null;
  chat_background_url: string | null;
  updated_at: string;
}

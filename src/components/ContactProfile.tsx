import { useEffect, useState } from 'react';
import { Calendar, Film, ImageIcon, Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { formatRelative } from '@/lib/format';
import type { Profile } from '@/lib/types';

export interface SharedMediaItem {
  id: string;
  attachment_type: string;
  attachment_url: string;
  attachment_name: string | null;
  created_at: string;
}

interface ContactProfileProps {
  contact: Profile;
  messageCount: number;
  open: boolean;
  onClose: () => void;
  onLoadMedia: (contactId: string) => Promise<SharedMediaItem[]>;
}

export function ContactProfile({
  contact,
  messageCount,
  open,
  onClose,
  onLoadMedia,
}: ContactProfileProps) {
  const [media, setMedia] = useState<SharedMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [lightbox, setLightbox] = useState<SharedMediaItem | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingMedia(true);
    onLoadMedia(contact.id).then((items) => {
      if (!cancelled) {
        setMedia(items);
        setLoadingMedia(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, contact.id, onLoadMedia]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightbox, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-[fadeIn_0.15s_ease-out]"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-800 bg-slate-900 shadow-2xl animate-[slideInRight_0.22s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Contact info</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Identity */}
          <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
            <Avatar name={contact.name} color={contact.avatar_color} size="lg" online={!contact.is_focus_mode_active} />
            <div>
              <h3 className="text-lg font-semibold text-slate-100">{contact.name}</h3>
              <p className={`text-xs ${contact.is_focus_mode_active ? 'text-purple-400' : 'text-emerald-400'}`}>
                {contact.is_focus_mode_active ? 'In focus mode' : 'Active now'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Connected {formatRelative(contact.created_at)} · {messageCount} messages
              </span>
            </div>
          </div>

          {/* Shared media */}
          <div className="border-t border-slate-800 px-4 py-4">
            <div className="mb-3 flex items-center gap-2 px-1">
              <ImageIcon className="h-4 w-4 text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-200">Shared media</h4>
              {media.length > 0 && (
                <span className="text-xs text-slate-500">{media.length}</span>
              )}
            </div>

            {loadingMedia ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading media…</span>
              </div>
            ) : media.length === 0 ? (
              <p className="px-1 py-8 text-center text-sm text-slate-500">
                No photos or videos shared yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLightbox(item)}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-slate-800"
                  >
                    {item.attachment_type === 'image' ? (
                      <img
                        src={item.attachment_url}
                        alt={item.attachment_name ?? 'Photo'}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-400">
                        <Film className="h-6 w-6" />
                      </div>
                    )}
                    {item.attachment_type === 'video' && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white">
                          <Film className="h-3.5 w-3.5" />
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 transition hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {lightbox.attachment_type === 'image' ? (
            <img
              src={lightbox.attachment_url}
              alt={lightbox.attachment_name ?? 'Photo'}
              className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={lightbox.attachment_url}
              controls
              autoPlay
              className="max-h-[88vh] max-w-[88vw] rounded-lg bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300">
            {lightbox.attachment_name ?? (lightbox.attachment_type === 'image' ? 'Photo' : 'Video')}
            {lightbox.attachment_name && (
              <span className="ml-2 text-slate-500">
                {formatRelative(lightbox.created_at)}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

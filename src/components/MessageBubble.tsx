import { FileText, Film, ImageIcon, MapPin, Navigation } from 'lucide-react';
import { formatSize, formatTime } from '@/lib/format';
import type { Message } from '@/lib/types';

interface MessageBubbleProps {
  message: Message;
  myId: string;
}

function Attachment({ message }: { message: Message }) {
  if (message.attachment_type === 'image' && message.attachment_url) {
    return (
      <a href={message.attachment_url} target="_blank" rel="noreferrer" className="block">
        <img
          src={message.attachment_url}
          alt={message.attachment_name ?? 'Photo'}
          className="max-h-72 w-full max-w-xs rounded-lg object-cover"
          loading="lazy"
        />
      </a>
    );
  }
  if (message.attachment_type === 'video' && message.attachment_url) {
    return (
      <video
        src={message.attachment_url}
        controls
        className="max-h-72 w-full max-w-xs rounded-lg bg-black"
      />
    );
  }
  if (message.attachment_type === 'document' && message.attachment_url) {
    return (
      <a
        href={message.attachment_url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-800 px-3 py-2.5 text-left transition hover:bg-slate-700"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">
            {message.attachment_name ?? 'Document'}
          </p>
          {message.attachment_size != null && (
            <p className="text-xs text-slate-400">{formatSize(message.attachment_size)}</p>
          )}
        </div>
      </a>
    );
  }
  return null;
}

function LocationCard({ message, mine }: { message: Message; mine: boolean }) {
  const lat = message.location_lat;
  const lng = message.location_lng;
  const label = message.is_live_location ? 'Live location' : 'My location';
  // Static map preview via OpenStreetMap (no API key needed).
  const bbox = lat != null && lng != null ? `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}` : '';
  const previewUrl =
    lat != null && lng != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
      : message.attachment_url ?? '';
  const openUrl = message.attachment_url ?? `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <a
      href={openUrl}
      target="_blank"
      rel="noreferrer"
      className={`block w-full max-w-xs overflow-hidden rounded-lg border ${
        mine ? 'border-white/20' : 'border-slate-700'
      }`}
    >
      <div className="relative h-32 w-full bg-slate-800">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title={label}
            className="h-full w-full border-0"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            <MapPin className="h-6 w-6" />
          </div>
        )}
        {message.is_live_location && (
          <span
            className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              mine ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            LIVE
          </span>
        )}
      </div>
      <div
        className={`flex items-center gap-2 px-3 py-2 text-xs ${
          mine ? 'text-white' : 'text-slate-300'
        }`}
      >
        <Navigation className="h-3.5 w-3.5" />
        <span className="font-medium">{label}</span>
        {lat != null && lng != null && (
          <span className="opacity-70">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        )}
      </div>
    </a>
  );
}

export function MessageBubble({ message, myId }: MessageBubbleProps) {
  const mine = message.sender_id === myId;
  const hasAttachment = message.attachment_type !== null && message.attachment_type !== 'location';
  const isLocation = message.attachment_type === 'location';
  const hasText = Boolean(message.content);

  // System auto-reply notices render as a centered pill, not a chat bubble.
  if (message.is_system) {
    return (
      <div className="my-1.5 flex w-full animate-[fadeIn_0.25s_ease-out] justify-center">
        <div className="flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-4 py-2 text-center text-[12px] text-purple-200">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex w-full animate-[fadeInUp_0.25s_ease-out] ${
        mine ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`flex max-w-[78%] flex-col gap-1.5 sm:max-w-[70%] ${
          mine ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={
            isLocation
              ? 'rounded-2xl p-1.5'
              : hasAttachment && !hasText
                ? 'rounded-2xl p-1.5'
                : `rounded-2xl px-3.5 py-2.5 shadow-sm ${
                    mine
                      ? 'rounded-br-md bg-blue-600 text-white'
                      : 'rounded-bl-md bg-slate-800 text-slate-100'
                  }`
          }
        >
          {isLocation && <LocationCard message={message} mine={mine} />}
          {hasAttachment && !isLocation && <Attachment message={message} />}
          {hasText && (
            <p
              className={`whitespace-pre-wrap break-words text-[14px] leading-relaxed ${
                hasAttachment || isLocation ? 'mt-1.5 px-2 pb-1 text-slate-300' : ''
              }`}
            >
              {message.content}
            </p>
          )}
        </div>
        <span className="px-1 text-[10px] text-slate-500">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}

export function AttachmentTypeIcon({ kind }: { kind: 'image' | 'video' | 'document' | 'location' }) {
  if (kind === 'image') return <ImageIcon className="h-5 w-5" />;
  if (kind === 'video') return <Film className="h-5 w-5" />;
  if (kind === 'location') return <MapPin className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

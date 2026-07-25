import { FileText, Film, ImageIcon } from 'lucide-react';
import { formatSize, formatTime } from '@/lib/format';
import type { Message } from '@/lib/types';

interface MessageBubbleProps {
  message: Message;
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

export function MessageBubble({ message }: MessageBubbleProps) {
  const mine = message.is_from_me;
  const hasAttachment = message.attachment_type !== null;
  const hasText = Boolean(message.content);

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
            hasAttachment && !hasText
              ? 'rounded-2xl p-1.5'
              : `rounded-2xl px-3.5 py-2.5 shadow-sm ${
                  mine
                    ? 'rounded-br-md bg-blue-600 text-white'
                    : 'rounded-bl-md bg-slate-800 text-slate-100'
                }`
          }
        >
          {hasAttachment && <Attachment message={message} />}
          {hasText && (
            <p
              className={`whitespace-pre-wrap break-words text-[14px] leading-relaxed ${
                hasAttachment ? 'mt-1.5 px-2 pb-1 text-slate-300' : ''
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

export function AttachmentTypeIcon({ kind }: { kind: 'image' | 'video' | 'document' }) {
  if (kind === 'image') return <ImageIcon className="h-5 w-5" />;
  if (kind === 'video') return <Film className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

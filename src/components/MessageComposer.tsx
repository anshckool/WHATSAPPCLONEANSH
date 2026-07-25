import { useRef, useState } from 'react';
import { Loader2, Paperclip, Send } from 'lucide-react';
import type { AttachmentType } from '@/lib/types';

interface MessageComposerProps {
  onSendText: (text: string) => void;
  onSendMedia: (file: File, kind: AttachmentType) => void;
  disabled: boolean;
  sending: boolean;
}

const ATTACH_OPTIONS: {
  kind: AttachmentType;
  label: string;
  accept: string;
  icon: string;
  ring: string;
}[] = [
  {
    kind: 'image',
    label: 'Photo',
    accept: 'image/*',
    icon: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z',
    ring: 'text-emerald-500',
  },
  {
    kind: 'video',
    label: 'Video',
    accept: 'video/*',
    icon: 'm22 8-6 4 6 4V8ZM2 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z',
    ring: 'text-sky-500',
  },
  {
    kind: 'document',
    label: 'Document',
    accept: '.pdf,.doc,.docx,.txt,.md,.zip,.xlsx,.pptx',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 13h6M9 17h6',
    ring: 'text-amber-500',
  },
];

export function MessageComposer({
  onSendText,
  onSendMedia,
  disabled,
  sending,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<AttachmentType>('image');

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendText(text);
    setText('');
  };

  const openPicker = (kind: AttachmentType, accept: string) => {
    pendingKind.current = kind;
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
    setMenuOpen(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSendMedia(file, pendingKind.current);
    e.target.value = '';
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900 px-3 py-3 sm:px-5">
      <form onSubmit={submitText} className="flex items-end gap-2">
        {/* Attach menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={disabled}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
            aria-label="Attach media"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute bottom-12 left-0 z-20 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl animate-[fadeInUp_0.15s_ease-out]">
                {ATTACH_OPTIONS.map((opt) => (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => openPicker(opt.kind, opt.accept)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-5 w-5 ${opt.ring}`}
                    >
                      <path d={opt.icon} />
                    </svg>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitText(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Type a message…"
          rows={1}
          disabled={disabled}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

import { useRef, useState } from 'react';
import { Eraser, ImageIcon, Loader2, Palette } from 'lucide-react';

interface ThemeButtonProps {
  backgroundUrl: string | null;
  onSet: (file: File) => void;
  onClear: () => void;
}

export function ThemeButton({ backgroundUrl, onSet, onClear }: ThemeButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (fileRef.current) {
      fileRef.current.accept = 'image/*';
      fileRef.current.click();
    }
    setOpen(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    Promise.resolve(onSet(file)).finally(() => setBusy(false));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
        aria-label="Customize chat theme"
        title="Customize chat theme"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Palette className="h-5 w-5" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 w-60 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl animate-[fadeInUp_0.15s_ease-out]">
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Chat theme
              </p>
            </div>
            <button
              type="button"
              onClick={pickFile}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
            >
              <ImageIcon className="h-5 w-5 text-sky-400" />
              Upload background
            </button>
            {backgroundUrl && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
              >
                <Eraser className="h-5 w-5 text-rose-400" />
                Remove background
              </button>
            )}
            <div className="border-t border-slate-800 px-3 py-2">
              <p className="text-[11px] text-slate-500">
                Upload an image from your computer to set it as the chat background.
              </p>
            </div>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

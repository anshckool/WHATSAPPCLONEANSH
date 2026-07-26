import { useEffect, useState } from 'react';
import { Focus, X } from 'lucide-react';

interface FocusModeToggleProps {
  active: boolean;
  minutesRemaining: number;
  onStart: (minutes: number) => void;
  onStop: () => void;
}

const DURATIONS = [15, 30, 45] as const;

function fmtClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FocusModeToggle({
  active,
  minutesRemaining,
  onStart,
  onStop,
}: FocusModeToggleProps) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Smooth MM:SS countdown while focus is active.
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const end = Date.now() + minutesRemaining * 60000;
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSeconds(left);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, minutesRemaining]);

  if (active) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold text-purple-300">
          <Focus className="h-3 w-3" />
          Deep Work
        </span>
        <span className="rounded-full bg-slate-800 px-2.5 py-1 font-mono text-[11px] tabular-nums text-slate-300">
          {fmtClock(seconds)}
        </span>
        <button
          type="button"
          onClick={onStop}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="End focus session"
          title="End focus session"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
      >
        <Focus className="h-3 w-3" />
        Focus
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl animate-[fadeInUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                <Focus className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Focus Mode</h3>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Start a deep-work block. Incoming messages get an automatic reply
              letting senders know when you&apos;re back.
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onStart(d);
                    setOpen(false);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-4 text-center transition hover:border-purple-500/50 hover:bg-purple-500/10"
                >
                  <span className="block text-lg font-bold text-slate-100">{d}</span>
                  <span className="text-xs text-slate-400">min</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl py-2 text-sm text-slate-400 transition hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

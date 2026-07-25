import { avatarTheme, initialOf } from '@/lib/format';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-12 w-12 text-lg',
};

export function Avatar({ name, color, size = 'md', online = false }: AvatarProps) {
  const theme = avatarTheme(color);
  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br ${theme.from} ${theme.to} font-semibold text-white shadow-sm ${sizeClasses[size]}`}
      >
        {initialOf(name)}
      </div>
      {online && (
        <span
          className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900`}
          aria-label="Online"
        />
      )}
    </div>
  );
}

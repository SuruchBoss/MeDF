import type { SVGProps } from 'react';

/**
 * A single inline icon set (Lucide-style 24px stroke geometry), so the app
 * ships no icon dependency and stays fully offline-capable.
 */

export type IconName =
  | 'align-center'
  | 'align-left'
  | 'align-right'
  | 'arrow-right'
  | 'bold'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'circle'
  | 'copy'
  | 'credit-card'
  | 'cursor'
  | 'download'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'globe'
  | 'grid'
  | 'highlight'
  | 'image'
  | 'italic'
  | 'layers'
  | 'line'
  | 'lock'
  | 'logout'
  | 'menu'
  | 'minus'
  | 'monitor'
  | 'pen'
  | 'plus'
  | 'redo'
  | 'rotate'
  | 'save'
  | 'settings'
  | 'shield'
  | 'sparkles'
  | 'square'
  | 'star'
  | 'text'
  | 'trash'
  | 'underline'
  | 'undo'
  | 'unlock'
  | 'upload'
  | 'user'
  | 'x'
  | 'zoom-in'
  | 'zoom-out';

const PATHS: Record<IconName, string> = {
  'align-center': 'M4 6h16M7 12h10M4 18h16',
  'align-left': 'M4 6h16M4 12h10M4 18h16',
  'align-right': 'M4 6h16M10 12h10M4 18h16',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  check: 'M4 12.5l5 5L20 6.5',
  'check-circle': 'M21 12a9 9 0 1 1-6.2-8.56M8.5 12.5l2.5 2.5L21 5',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  copy: 'M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4M5 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
  'credit-card': 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3',
  cursor: 'M5 3l14 8-6 1.5L10 19z',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 9.5A2.5 2.5 0 1 0 12 14.5 2.5 2.5 0 0 0 12 9.5z',
  'eye-off': 'M4 4l16 16M10 6a10.8 10.8 0 0 1 2-.2c6.4 0 10 6.2 10 6.2a18 18 0 0 1-2.6 3.3M6.4 7.6A17.4 17.4 0 0 0 2 12s3.6 6.2 10 6.2a10 10 0 0 0 3.2-.5',
  'file-text': 'M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM9 13h6M9 17h4',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  highlight: 'M4 20h6M9 15l-3 3 2 2 3-3M12 12l6-6a2.1 2.1 0 0 1 3 3l-6 6-4 1z',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM4 17l5-5 4 4 2.5-2.5L20 17',
  italic: 'M15 5h-6M14 5l-4 14M13 19H7',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  line: 'M5 19L19 5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h11',
  menu: 'M4 7h16M4 12h16M4 17h16',
  minus: 'M5 12h14',
  monitor: 'M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 20h8M12 16v4',
  pen: 'M4 20h4l11-11a2.5 2.5 0 0 0-3.5-3.5L4 16z',
  plus: 'M12 5v14M5 12h14',
  redo: 'M20 10h-9a5 5 0 0 0 0 10h6M20 10l-4-4M20 10l-4 4',
  rotate: 'M20 5v5h-5M20 10a8 8 0 1 0-2.3 7',
  save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-6h8v6',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.2 4.5a2 2 0 1 1 4 0A1.6 1.6 0 0 0 16.9 5.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.4 11a2 2 0 1 1 0 4z',
  shield: 'M12 3l8 3v6c0 5-3.4 8.2-8 9.5C7.4 20.2 4 17 4 12V6z',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z',
  square: 'M4 4h16v16H4z',
  star: 'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z',
  text: 'M5 6V4h14v2M12 4v16M8 20h8',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 14h10l1-14M10 11v6M14 11v6',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  undo: 'M4 10h9a5 5 0 0 1 0 10H7M4 10l4-4M4 10l4 4',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  x: 'M6 6l12 12M18 6L6 18',
  'zoom-in': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  'zoom-out': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The MeDF mark: a document sheet with a folded corner and one element placed
 * on it — which is exactly what the product does. The same geometry is
 * rasterised for the Windows icon by `desktop/scripts/make-icon.mjs`, so the
 * web and the installed app share one identity.
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  // Fixed gradient ids: this renders in Server Components too, where `useId`
  // is unavailable. Several marks on one page therefore repeat the definition,
  // which resolves to an identical gradient and looks the same.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="MeDF"
    >
      <defs>
        <linearGradient id="medf-logo-tile" x1="2" y1="0" x2="30" y2="32">
          <stop stopColor="#4f46e5" />
          <stop offset="0.5" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>

      {/* App tile */}
      <rect width="32" height="32" rx="8.5" fill="url(#medf-logo-tile)" />

      {/* The document: a sheet with its top-right corner folded over */}
      <path d="M6.4 8.4A2.8 2.8 0 0 1 9.2 5.6h7.4l5.6 5.6v9.2A2.8 2.8 0 0 1 19.4 23.2H9.2A2.8 2.8 0 0 1 6.4 20.4z" fill="#fff" />
      <path d="M16.6 5.6 22.2 11.2h-5.6z" fill="#c4b5fd" />
      <rect x="9.3" y="12.4" width="8.6" height="1.9" rx="0.95" fill="#4f46e5" fillOpacity="0.32" />
      <rect x="9.3" y="15.8" width="5.6" height="1.9" rx="0.95" fill="#4f46e5" fillOpacity="0.32" />

      {/* An element dragged onto the page, with its selection handle: the
          overlap is the whole idea of the product. */}
      <rect x="14.2" y="16.8" width="11.2" height="8.4" rx="2.4" fill="#fff" stroke="#4f46e5" strokeWidth="2.2" />
      <circle cx="25.4" cy="25.2" r="2.4" fill="#fff" stroke="#4f46e5" strokeWidth="2" />
    </svg>
  );
}

/** Word mark used in the header, the editor chrome and the desktop shell. */
export function Logo({
  className = '',
  showText = true,
  size = 30,
}: {
  className?: string;
  showText?: boolean;
  size?: number;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showText ? (
        <span className="text-[1.2rem] leading-none font-extrabold tracking-[-0.025em]">
          Me<span className="text-brand-600">DF</span>
        </span>
      ) : null}
    </span>
  );
}

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" fill="none" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

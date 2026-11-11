import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props
});

export const HomeIcon = (p: P) => (
  <svg {...base(p)}><path d="M3.5 8.5 10 3.5l6.5 5V16a1 1 0 0 1-1 1h-3.5v-5h-4v5H4.5a1 1 0 0 1-1-1V8.5Z" /></svg>
);
export const OrdersIcon = (p: P) => (
  <svg {...base(p)}><path d="M3.5 5.5h13l-1.2 9.1a1.5 1.5 0 0 1-1.5 1.4H6.2a1.5 1.5 0 0 1-1.5-1.4L3.5 5.5Z" /><path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" /></svg>
);
export const ProductsIcon = (p: P) => (
  <svg {...base(p)}><path d="M10.6 3H16a1 1 0 0 1 1 1v5.4a1 1 0 0 1-.3.7l-6.6 6.6a1 1 0 0 1-1.4 0L3.3 11.3a1 1 0 0 1 0-1.4l6.6-6.6a1 1 0 0 1 .7-.3Z" /><circle cx="13.5" cy="6.5" r="1" /></svg>
);
export const CollectionsIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="6" height="6" rx="1.2" /><rect x="11" y="3" width="6" height="6" rx="1.2" /><rect x="3" y="11" width="6" height="6" rx="1.2" /><rect x="11" y="11" width="6" height="6" rx="1.2" /></svg>
);
export const CustomersIcon = (p: P) => (
  <svg {...base(p)}><circle cx="10" cy="7" r="3.2" /><path d="M3.8 16.5a6.3 6.3 0 0 1 12.4 0" /></svg>
);
export const DiscountsIcon = (p: P) => (
  <svg {...base(p)}><circle cx="10" cy="10" r="7" /><path d="m7.5 12.5 5-5" /><circle cx="7.6" cy="7.6" r=".6" fill="currentColor" /><circle cx="12.4" cy="12.4" r=".6" fill="currentColor" /></svg>
);
export const SettingsIcon = (p: P) => (
  <svg {...base(p)}><circle cx="10" cy="10" r="2.5" /><path d="M10 2.8v1.7M10 15.5v1.7M17.2 10h-1.7M4.5 10H2.8M15.1 4.9l-1.2 1.2M6.1 13.9l-1.2 1.2M15.1 15.1l-1.2-1.2M6.1 6.1 4.9 4.9" /></svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="9" r="5.5" /><path d="m13.2 13.2 3.3 3.3" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}><path d="M10 4.5v11M4.5 10h11" /></svg>
);
export const ArrowLeftIcon = (p: P) => (
  <svg {...base(p)}><path d="M15.5 10h-11M9 5.5 4.5 10 9 14.5" /></svg>
);
export const ChevronDownIcon = (p: P) => (
  <svg {...base(p)}><path d="m6 8 4 4 4-4" /></svg>
);
export const ChevronUpIcon = (p: P) => (
  <svg {...base(p)}><path d="m6 12 4-4 4 4" /></svg>
);
export const XIcon = (p: P) => (
  <svg {...base(p)}><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></svg>
);
export const ImageIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="14" height="12" rx="2" /><circle cx="7.5" cy="8.5" r="1.3" /><path d="m17 13-3.8-3.8L5.5 16" /></svg>
);
export const MenuIcon = (p: P) => (
  <svg {...base(p)}><path d="M3.5 6h13M3.5 10h13M3.5 14h13" /></svg>
);
export const StoreIcon = (p: P) => (
  <svg {...base(p)}><path d="M3.5 8V16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8M2.8 8h14.4l-1.7-4.4a1 1 0 0 0-.9-.6H5.4a1 1 0 0 0-.9.6L2.8 8Z" /><path d="M8 17v-4.5h4V17" /></svg>
);
export const ExternalIcon = (p: P) => (
  <svg {...base(p)}><path d="M11.5 3.5h5v5M16.5 3.5 9.5 10.5M14.5 12v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H8" /></svg>
);
export const TrashIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 6h12M8 6V4.5h4V6M5.5 6l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9L14.5 6" /></svg>
);
export const DragIcon = (p: P) => (
  <svg {...base(p)}><circle cx="8" cy="6" r=".7" fill="currentColor" /><circle cx="12" cy="6" r=".7" fill="currentColor" /><circle cx="8" cy="10" r=".7" fill="currentColor" /><circle cx="12" cy="10" r=".7" fill="currentColor" /><circle cx="8" cy="14" r=".7" fill="currentColor" /><circle cx="12" cy="14" r=".7" fill="currentColor" /></svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base(p)}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
);
export const AlertIcon = (p: P) => (
  <svg {...base(p)}><circle cx="10" cy="10" r="7" /><path d="M10 6.5v4M10 13.5v.01" /></svg>
);
export const LogoutIcon = (p: P) => (
  <svg {...base(p)}><path d="M8 16.5H4.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H8M13 13.5 16.5 10 13 6.5M16.5 10H8" /></svg>
);
export const BoldIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 4h5a3 3 0 0 1 0 6H6V4ZM6 10h5.5a3 3 0 0 1 0 6H6v-6Z" /></svg>
);
export const ItalicIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 4H8.5M11.5 16H8M11 4l-2 12" /></svg>
);
export const UnderlineIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 4v5a4 4 0 0 0 8 0V4M5 16.5h10" /></svg>
);
export const ListIcon = (p: P) => (
  <svg {...base(p)}><path d="M8 6h8M8 10h8M8 14h8" /><circle cx="4.5" cy="6" r=".7" fill="currentColor" /><circle cx="4.5" cy="10" r=".7" fill="currentColor" /><circle cx="4.5" cy="14" r=".7" fill="currentColor" /></svg>
);
export const LinkIcon = (p: P) => (
  <svg {...base(p)}><path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.8.8M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.8-.8" /></svg>
);
export const HeadingIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 4v12M15 4v12M5 10h10" /></svg>
);

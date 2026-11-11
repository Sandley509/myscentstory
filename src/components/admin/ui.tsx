import clsx from 'clsx';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { ArrowLeftIcon, ImageIcon } from './icons';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function Page({
  title,
  titleMeta,
  subtitle,
  backHref,
  primaryAction,
  secondaryActions,
  narrow,
  children
}: {
  title: ReactNode;
  titleMeta?: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={clsx('mx-auto w-full px-4 pb-16 pt-5 sm:px-6', narrow ? 'max-w-[1000px]' : 'max-w-[1200px]')}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-admin-subdued hover:bg-black/5"
            >
              <ArrowLeftIcon width={18} height={18} />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[20px] font-bold leading-7 text-admin-text">{title}</h1>
              {titleMeta}
            </div>
            {subtitle && <div className="mt-0.5 text-[13px] text-admin-subdued">{subtitle}</div>}
          </div>
        </div>
        {(primaryAction || secondaryActions) && (
          <div className="flex flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Two-column layout: main + 1/3 sidebar, stacking on mobile. */
export function Layout({ main, aside }: { main: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      {aside && <div className="flex min-w-0 flex-col gap-4">{aside}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  title,
  actions,
  children,
  flush,
  className
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** No inner padding (for tables / lists). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={clsx('admin-card overflow-hidden', className)}>
      {(title || actions) && (
        <div className={clsx('flex items-center justify-between gap-2 px-4 pt-4', flush && 'pb-3')}>
          {title && <h2 className="text-[13px] font-semibold text-admin-text">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {flush ? children : <div className={clsx('px-4 pb-4', title || actions ? 'pt-3' : 'pt-4')}>{children}</div>}
    </section>
  );
}

export function CardSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('border-t border-admin-border px-4 py-3', className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export type BadgeTone = 'default' | 'success' | 'warning' | 'info' | 'critical' | 'attention';

const toneClasses: Record<BadgeTone, string> = {
  default: 'bg-[#e3e3e3] text-[#616161]',
  success: 'bg-admin-success-bg text-admin-success-text',
  warning: 'bg-admin-warning-bg text-admin-warning-text',
  attention: 'bg-[#ffd6a4] text-[#5e4200]',
  info: 'bg-admin-info-bg text-admin-info-text',
  critical: 'bg-admin-critical-bg text-admin-critical-text'
};

export function Badge({
  tone = 'default',
  dot,
  children
}: {
  tone?: BadgeTone;
  /** "incomplete" (hollow), "partial" (half) or "complete" (filled) dot. */
  dot?: 'incomplete' | 'partial' | 'complete';
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[12px] font-medium leading-4',
        toneClasses[tone]
      )}
    >
      {dot && (
        <span
          className={clsx(
            'inline-block h-2 w-2 rounded-full border-[1.5px] border-current',
            dot === 'complete' && 'bg-current',
            dot === 'partial' && 'bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]'
          )}
        />
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'critical' | 'tertiary';

const buttonClasses = (variant: ButtonVariant, size: 'slim' | 'medium') =>
  clsx(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-admin-focus',
    size === 'slim' ? 'h-7 px-2.5' : 'h-8 px-3',
    variant === 'primary' && 'admin-btn-primary text-white',
    variant === 'secondary' && 'admin-btn-secondary text-admin-text',
    variant === 'critical' && 'bg-admin-critical text-white hover:bg-[#a30a1e]',
    variant === 'tertiary' && 'bg-transparent text-admin-text hover:bg-black/5',
    variant === 'plain' && '!h-auto !px-0 font-medium text-admin-link hover:underline'
  );

export function Button({
  variant = 'secondary',
  size = 'medium',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'slim' | 'medium' }) {
  return <button type="button" className={clsx(buttonClasses(variant, size), className)} {...props} />;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'medium',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: 'slim' | 'medium' }) {
  return <Link className={clsx(buttonClasses(variant, size), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  helpText,
  error,
  children,
  labelAction
}: {
  label?: ReactNode;
  htmlFor?: string;
  helpText?: ReactNode;
  error?: string | null;
  children: ReactNode;
  labelAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={htmlFor} className="text-[13px] text-admin-text">
            {label}
          </label>
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-[13px] text-admin-critical">{error}</p>
      ) : (
        helpText && <p className="text-[13px] text-admin-subdued">{helpText}</p>
      )}
    </div>
  );
}

export function TextInput({
  prefix,
  suffix,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'prefix'> & { prefix?: ReactNode; suffix?: ReactNode }) {
  if (!prefix && !suffix) return <input className={clsx('admin-input', className)} {...props} />;
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-admin-subdued">
          {prefix}
        </span>
      )}
      <input
        className={clsx('admin-input', prefix && 'pl-7', suffix && 'pr-9', className)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-admin-subdued">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={clsx('admin-input py-1.5', className)} rows={3} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={clsx('admin-input appearance-none pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23616161' stroke-width='1.6'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '16px'
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  helpText,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label?: ReactNode; helpText?: ReactNode }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[#303030]"
        {...props}
      />
      {(label || helpText) && (
        <span>
          {label && <span className="text-[13px] text-admin-text">{label}</span>}
          {helpText && <span className="block text-[13px] text-admin-subdued">{helpText}</span>}
        </span>
      )}
    </label>
  );
}

export function Radio({
  label,
  helpText,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode; helpText?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="radio" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#303030]" {...props} />
      <span>
        <span className="text-[13px] text-admin-text">{label}</span>
        {helpText && <span className="block text-[13px] text-admin-subdued">{helpText}</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function Thumbnail({ src, alt = '', size = 40 }: { src?: string | null; alt?: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-[#f7f7f7]"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon width={size * 0.5} height={size * 0.5} className="text-admin-disabled" />
      )}
    </span>
  );
}

export function EmptyState({
  heading,
  children,
  action,
  icon
}: {
  heading: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 text-admin-disabled">{icon}</div>}
      <h2 className="text-[14px] font-semibold text-admin-text">{heading}</h2>
      {children && <p className="mt-1 max-w-sm text-[13px] text-admin-subdued">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  current
}: {
  tabs: { label: string; href: string; value: string }[];
  current: string;
}) {
  return (
    <div className="scrollbar-hide flex gap-1 overflow-x-auto px-2 pt-2">
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          className={clsx(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium',
            t.value === current ? 'bg-admin-selected text-admin-text' : 'text-admin-subdued hover:bg-admin-hover'
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Banner({
  tone = 'info',
  title,
  children
}: {
  tone?: 'info' | 'warning' | 'critical' | 'success';
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border px-4 py-3 text-[13px]',
        tone === 'info' && 'border-[#a8d8ff] bg-[#eaf4ff]',
        tone === 'warning' && 'border-[#ffd580] bg-[#fff5d6]',
        tone === 'critical' && 'border-[#fdb4b4] bg-[#fff0f0]',
        tone === 'success' && 'border-[#92e6b5] bg-[#ecfff3]'
      )}
      role={tone === 'critical' ? 'alert' : 'status'}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
    </div>
  );
}

export function Pagination({
  page,
  hasNext,
  hrefFor
}: {
  page: number;
  hasNext: boolean;
  hrefFor: (page: number) => string;
}) {
  if (page <= 1 && !hasNext) return null;
  const cls = 'admin-btn-secondary inline-flex h-7 w-8 items-center justify-center rounded-lg';
  return (
    <div className="flex items-center justify-center gap-1 border-t border-admin-border py-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cls} aria-label="Previous page">‹</Link>
      ) : (
        <span className={clsx(cls, 'opacity-40')}>‹</span>
      )}
      {hasNext ? (
        <Link href={hrefFor(page + 1)} className={cls} aria-label="Next page">›</Link>
      ) : (
        <span className={clsx(cls, 'opacity-40')}>›</span>
      )}
    </div>
  );
}

'use client';

import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import {
  BoldIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HeadingIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  TrashIcon,
  UnderlineIcon,
  XIcon
} from './icons';

// ---------------------------------------------------------------------------
// Rich text editor (lightweight, contentEditable)
// ---------------------------------------------------------------------------

export function RichTextEditor({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);

  // Only push external value into the DOM when it differs (e.g. on Discard),
  // so the caret doesn't jump while typing.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value, showHtml]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  };

  const tool = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={showHtml}
      className="flex h-7 w-7 items-center justify-center rounded-md text-admin-subdued hover:bg-black/5 disabled:opacity-40"
    >
      {icon}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-[#8a8a8a] focus-within:border-admin-focus focus-within:shadow-[0_0_0_1px_var(--color-admin-focus)]">
      <div className="flex items-center gap-0.5 border-b border-admin-border bg-[#f7f7f7] px-1.5 py-1">
        {tool('Heading', <HeadingIcon width={16} height={16} />, () => exec('formatBlock', 'h2'))}
        {tool('Paragraph', <span className="text-[12px] font-semibold">P</span>, () => exec('formatBlock', 'p'))}
        <span className="mx-1 h-4 w-px bg-admin-border" />
        {tool('Bold', <BoldIcon width={16} height={16} />, () => exec('bold'))}
        {tool('Italic', <ItalicIcon width={16} height={16} />, () => exec('italic'))}
        {tool('Underline', <UnderlineIcon width={16} height={16} />, () => exec('underline'))}
        <span className="mx-1 h-4 w-px bg-admin-border" />
        {tool('Bulleted list', <ListIcon width={16} height={16} />, () => exec('insertUnorderedList'))}
        {tool('Link', <LinkIcon width={16} height={16} />, () => {
          const url = window.prompt('Link URL (https://…)');
          if (url && /^(https?:\/\/|\/|mailto:)/i.test(url)) exec('createLink', url);
        })}
        <button
          type="button"
          onClick={() => setShowHtml((s) => !s)}
          className={clsx(
            'ml-auto rounded-md px-2 py-1 font-mono text-[11px] hover:bg-black/5',
            showHtml ? 'bg-black/10 text-admin-text' : 'text-admin-subdued'
          )}
        >
          {'</>'}
        </button>
      </div>
      {showHtml ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block min-h-[160px] w-full resize-y p-3 font-mono text-[12px] outline-none"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          className="admin-rte bg-white"
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tags input
// ---------------------------------------------------------------------------

export function TagsInput({
  value,
  onChange,
  placeholder = 'Add tags',
  suggestions = []
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft('');
  };
  const listId = `tags-${useId().replace(/:/g, '')}`;

  return (
    <div>
      <input
        className="admin-input"
        value={draft}
        placeholder={placeholder}
        list={suggestions.length ? listId : undefined}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-[#e3e3e3] py-0.5 pl-2 pr-1 text-[12px]">
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="rounded p-0.5 hover:bg-black/10"
              >
                <XIcon width={12} height={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media uploader (Supabase Storage, `product-images` bucket)
// ---------------------------------------------------------------------------

export type MediaItem = {
  id?: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

const readSize = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: 1200, height: 1200 });
    img.src = URL.createObjectURL(file);
  });

export async function uploadImage(file: File, folder: string): Promise<MediaItem> {
  const supabase = createBrowserSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const [{ width, height }, { error }] = await Promise.all([
    readSize(file),
    supabase.storage.from('product-images').upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false
    })
  ]);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return { url: data.publicUrl, alt: null, width, height };
}

export function MediaUploader({
  value,
  onChange,
  folder,
  single
}: {
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  folder: string;
  single?: boolean;
}) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setError(null);
    setUploading((n) => n + list.length);
    const results: MediaItem[] = [];
    for (const f of single ? list.slice(0, 1) : list) {
      try {
        if (f.size > 20 * 1024 * 1024) throw new Error(`${f.name} is larger than 20MB.`);
        results.push(await uploadImage(f, folder));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onChange(single ? results.slice(0, 1) : [...value, ...results]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div>
      <div
        className={clsx(
          'grid gap-2',
          single ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
        )}
      >
        {value.map((m, i) => (
          <div
            key={m.id ?? m.url}
            className={clsx(
              'group relative aspect-square overflow-hidden rounded-lg border border-admin-border bg-[#f7f7f7]',
              !single && i === 0 && 'col-span-2 row-span-2'
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.alt ?? ''} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-start justify-end gap-1 bg-black/0 p-1.5 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100 focus-within:opacity-100">
              {!single && i > 0 && (
                <button type="button" onClick={() => move(i, -1)} className="rounded-md bg-white p-1 shadow" aria-label="Move earlier">
                  <ChevronUpIcon width={14} height={14} className="-rotate-90" />
                </button>
              )}
              {!single && i < value.length - 1 && (
                <button type="button" onClick={() => move(i, 1)} className="rounded-md bg-white p-1 shadow" aria-label="Move later">
                  <ChevronDownIcon width={14} height={14} className="-rotate-90" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, k) => k !== i))}
                className="rounded-md bg-white p-1 text-admin-critical shadow"
                aria-label="Remove image"
              >
                <TrashIcon width={14} height={14} />
              </button>
            </div>
          </div>
        ))}

        {(!single || value.length === 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFiles(e.dataTransfer.files);
            }}
            className={clsx(
              'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition',
              value.length === 0 ? 'col-span-full min-h-[140px]' : 'aspect-square',
              dragOver ? 'border-admin-focus bg-[#eaf4ff]' : 'border-[#8a8a8a] hover:bg-admin-hover'
            )}
          >
            {uploading > 0 ? (
              <span className="text-[13px] text-admin-subdued">Uploading {uploading}…</span>
            ) : value.length === 0 ? (
              <>
                <span className="admin-btn-secondary rounded-lg px-3 py-1 text-[13px] font-semibold">Upload new</span>
                <span className="text-[12px] text-admin-subdued">Accepts images · drag and drop</span>
              </>
            ) : (
              <ImageIcon className="text-admin-subdued" />
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {error && <p className="mt-2 text-[13px] text-admin-critical">{error}</p>}
    </div>
  );
}

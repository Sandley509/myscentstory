'use client';

import { MediaUploader } from '@/components/admin/inputs';
import { SaveBar, Toast } from '@/components/admin/overlays';
import { Banner, Card, Checkbox, Field, Page, TextArea, TextInput } from '@/components/admin/ui';
import { saveContent } from '@/lib/admin/actions/content';
import { DEFAULT_CONTENT, type SiteContent } from '@/lib/content';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, useTransition, type ReactNode } from 'react';

type LinkOption = { label: string; value: string };

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-admin-border py-6 first:pt-0 last:border-b-0 md:grid-cols-[280px_1fr]">
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-1 text-admin-subdued">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** Free-text link with the store's own pages offered as suggestions. */
function LinkField({
  label,
  value,
  onChange,
  options,
  helpText
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: LinkOption[];
  helpText?: string;
}) {
  const id = useId();
  const valid = !value || /^\/(?!\/)/.test(value) || /^https:\/\//i.test(value);
  return (
    <Field
      label={label}
      helpText={helpText ?? 'Pick a page or paste a link.'}
      error={valid ? null : 'Start with / for a page on this store, or https:// for another site.'}
    >
      <TextInput list={id} value={value} placeholder="/collections/all" onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
    </Field>
  );
}

function ImageField({
  label,
  value,
  onChange,
  helpText
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  helpText: string;
}) {
  return (
    <Field label={label} helpText={helpText}>
      <MediaUploader
        single
        folder="site"
        value={value ? [{ url: value, alt: '', width: null, height: null }] : []}
        onChange={(items) => onChange(items[0]?.url ?? '')}
      />
    </Field>
  );
}

const count = (value: string, max: number) => `${value.length} of ${max} characters used`;

export function ContentForm({
  initial,
  linkOptions,
  automaticAnnouncement,
  setupNeeded
}: {
  initial: SiteContent;
  linkOptions: LinkOption[];
  automaticAnnouncement: string;
  setupNeeded: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [c, setC] = useState(initial);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);

  /** Update one field of one section, e.g. set('hero', 'title', '…'). */
  const set = <S extends keyof SiteContent, K extends keyof SiteContent[S]>(section: S, key: K, value: SiteContent[S][K]) =>
    setC((x) => ({ ...x, [section]: { ...x[section], [key]: value } }));

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveContent(c);
      if (!res.ok) return setError(res.error);
      // Adopt the cleaned copy the server stored (trimmed text, rejected links removed).
      setC(res.data);
      setSaved(res.data);
      setToast('Online store updated');
      router.refresh();
    });

  return (
    <Page
      title="Online store"
      secondaryActions={
        <a href="/" target="_blank" rel="noreferrer" className="admin-btn-secondary inline-flex h-8 items-center rounded-lg px-3 font-semibold">
          View store
        </a>
      }
    >
      <SaveBar visible={dirty} saving={saving} onSave={save} onDiscard={() => setC(saved)} />

      {setupNeeded && (
        <div className="mb-4">
          <Banner tone="warning" title="One setup step left">
            Run <code>supabase/migrations/0003_site_content.sql</code> in the Supabase SQL editor. Until then the store
            shows the default content and changes here can’t be saved.
          </Banner>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Banner tone="critical" title="Your changes weren’t saved">
            {error}
          </Banner>
        </div>
      )}

      <Section title="Announcement bar" description="The black strip at the very top of every page.">
        <Card>
          <div className="flex flex-col gap-4">
            <Checkbox
              label="Show the announcement bar"
              checked={c.announcement.enabled}
              onChange={(e) => set('announcement', 'enabled', e.target.checked)}
            />
            {c.announcement.enabled && (
              <>
                <Field label="Message" helpText={`Leave empty to show “${automaticAnnouncement}”, which follows your shipping settings.`}>
                  <TextInput
                    value={c.announcement.text}
                    maxLength={120}
                    placeholder={automaticAnnouncement}
                    onChange={(e) => set('announcement', 'text', e.target.value)}
                  />
                </Field>
                <LinkField
                  label="Link (optional)"
                  value={c.announcement.link}
                  onChange={(v) => set('announcement', 'link', v)}
                  options={linkOptions}
                  helpText="Makes the message clickable. Leave empty for plain text."
                />
              </>
            )}
          </div>
        </Card>
      </Section>

      <Section title="Main banner" description="The large banner at the top of the home page. Its heading is the page’s main title for Google.">
        <Card>
          <div className="flex flex-col gap-4">
            <ImageField
              label="Banner photo"
              value={c.hero.imageUrl}
              onChange={(url) => set('hero', 'imageUrl', url)}
              helpText="Wide photo, about 2400 × 800 px, with the subject on the left and a dark, empty right side: the white text sits there. Remove the photo to show the bottle artwork instead."
            />
            <Field label="Small line above the heading">
              <TextInput value={c.hero.eyebrow} maxLength={60} onChange={(e) => set('hero', 'eyebrow', e.target.value)} />
            </Field>
            <Field label="Heading" helpText={count(c.hero.title, 80)}>
              <TextInput value={c.hero.title} maxLength={80} placeholder={DEFAULT_CONTENT.hero.title} onChange={(e) => set('hero', 'title', e.target.value)} />
            </Field>
            <Field label="Text" helpText={count(c.hero.text, 200)}>
              <TextArea value={c.hero.text} maxLength={200} onChange={(e) => set('hero', 'text', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Button label" helpText="Leave empty to hide the button.">
                <TextInput value={c.hero.buttonLabel} maxLength={30} onChange={(e) => set('hero', 'buttonLabel', e.target.value)} />
              </Field>
              <LinkField label="Button link" value={c.hero.buttonLink} onChange={(v) => set('hero', 'buttonLink', v)} options={linkOptions} />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Promo band" description="The coloured strip under the main banner. Use it for a sale, a gift guide or a new arrival.">
        <Card>
          <div className="flex flex-col gap-4">
            <Checkbox label="Show the promo band" checked={c.promo.enabled} onChange={(e) => set('promo', 'enabled', e.target.checked)} />
            {c.promo.enabled && (
              <>
                <Field label="Heading">
                  <TextInput value={c.promo.title} maxLength={80} onChange={(e) => set('promo', 'title', e.target.value)} />
                </Field>
                <Field label="Text">
                  <TextInput value={c.promo.text} maxLength={160} onChange={(e) => set('promo', 'text', e.target.value)} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Button label" helpText="Leave empty to hide the button.">
                    <TextInput value={c.promo.buttonLabel} maxLength={30} onChange={(e) => set('promo', 'buttonLabel', e.target.value)} />
                  </Field>
                  <LinkField label="Button link" value={c.promo.buttonLink} onChange={(v) => set('promo', 'buttonLink', v)} options={linkOptions} />
                </div>
              </>
            )}
          </div>
        </Card>
      </Section>

      <Section
        title="Home page sections"
        description="Headings for the product and category sections. The products come from your catalogue; category tiles use each collection’s image."
      >
        <Card title="Featured products">
          <Field label="Heading" helpText="Above the Best sellers / New / Gift sets tabs.">
            <TextInput value={c.featured.title} maxLength={60} onChange={(e) => set('featured', 'title', e.target.value)} />
          </Field>
        </Card>
        <Card title="Scent families">
          <div className="flex flex-col gap-4">
            <Checkbox label="Show this section" checked={c.families.enabled} onChange={(e) => set('families', 'enabled', e.target.checked)} />
            {c.families.enabled && (
              <>
                <ImageField
                  label="Photo"
                  value={c.families.imageUrl}
                  onChange={(url) => set('families', 'imageUrl', url)}
                  helpText="Square photo, at least 1200 × 1200 px. Without one the store shows the bottle artwork."
                />
                <Field label="Heading">
                  <TextInput value={c.families.title} maxLength={60} onChange={(e) => set('families', 'title', e.target.value)} />
                </Field>
                <Field label="Text" helpText="The family buttons are built from the “Scent family” of your products.">
                  <TextArea value={c.families.text} maxLength={200} onChange={(e) => set('families', 'text', e.target.value)} />
                </Field>
              </>
            )}
          </div>
        </Card>
        <Card title="Categories">
          <Field label="Heading" helpText="To change a tile’s picture, open the collection and upload an image.">
            <TextInput value={c.categories.title} maxLength={60} onChange={(e) => set('categories', 'title', e.target.value)} />
          </Field>
        </Card>
      </Section>

      <Section
        title="Welcome offer"
        description="A popup shown once to first-time visitors. They leave their email (added to your customers as a subscriber) and get the code, which is applied to their cart automatically."
      >
        <Card>
          <div className="flex flex-col gap-4">
            <Checkbox label="Show the welcome offer" checked={c.welcome.enabled} onChange={(e) => set('welcome', 'enabled', e.target.checked)} />
            {c.welcome.enabled && (
              <>
                <Field label="Heading">
                  <TextInput value={c.welcome.title} maxLength={60} onChange={(e) => set('welcome', 'title', e.target.value)} />
                </Field>
                <Field label="Text">
                  <TextArea value={c.welcome.text} maxLength={200} onChange={(e) => set('welcome', 'text', e.target.value)} />
                </Field>
                <Field
                  label="Discount code"
                  helpText="Create or edit it in Discounts. Tick “First order only” there so returning customers can’t reuse it."
                >
                  <TextInput
                    value={c.welcome.code}
                    maxLength={40}
                    onChange={(e) => set('welcome', 'code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  />
                </Field>
              </>
            )}
          </div>
        </Card>
      </Section>

      <Section title="Social media" description="Shown as icons in the footer and sent to Google as your official profiles. Empty links are hidden.">
        <Card>
          <div className="flex flex-col gap-4">
            {(
              [
                ['instagram', 'Instagram', 'https://www.instagram.com/yourshop'],
                ['facebook', 'Facebook', 'https://www.facebook.com/yourshop'],
                ['tiktok', 'TikTok', 'https://www.tiktok.com/@yourshop']
              ] as const
            ).map(([key, label, placeholder]) => (
              <Field
                key={key}
                label={label}
                error={c.social[key] && !/^https:\/\//i.test(c.social[key]) ? 'Paste the full link, starting with https://' : null}
              >
                <TextInput type="url" value={c.social[key]} placeholder={placeholder} onChange={(e) => set('social', key, e.target.value)} />
              </Field>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Search engine listing" description="How the home page appears in Google results. Leave empty to use the built-in title and description.">
        <Card>
          <div className="flex flex-col gap-4">
            <Field label="Page title" helpText={count(c.seo.homeTitle, 70)}>
              <TextInput value={c.seo.homeTitle} maxLength={70} placeholder="MyScentStory | Perfumes for Her & Him" onChange={(e) => set('seo', 'homeTitle', e.target.value)} />
            </Field>
            <Field label="Meta description" helpText={count(c.seo.homeDescription, 160)}>
              <TextArea value={c.seo.homeDescription} maxLength={160} onChange={(e) => set('seo', 'homeDescription', e.target.value)} />
            </Field>
          </div>
        </Card>
      </Section>

      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

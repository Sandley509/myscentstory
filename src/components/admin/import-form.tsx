'use client';

import { uploadImage } from '@/components/admin/inputs';
import { Badge, Banner, Button, ButtonLink, Card, Page } from '@/components/admin/ui';
import { importProducts, type ImportItem, type ImportOutcome } from '@/lib/admin/actions/import';
import { checkProducts, fileKey, parseSheet, type ImportProduct, type ParseResult } from '@/lib/admin/import-sheet';
import { formatMoney } from '@/lib/admin/format';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Products saved per server request; their photos are uploaded just before. */
const BATCH = 10;
const UPLOAD_CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    })
  );
  return out;
}

const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(f.name);

export function ImportForm({ currency }: { currency: string }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Map<string, File>>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; step: string } | null>(null);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  // `webkitdirectory` isn't in React's prop types; set it on the element itself.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  // Local previews of the selected photos (freed when the selection changes).
  const previews = useMemo(() => {
    const m = new Map<string, string>();
    photos.forEach((file, key) => m.set(key, URL.createObjectURL(file)));
    return m;
  }, [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const products = useMemo(() => parsed?.products ?? [], [parsed]);
  const checks = useMemo(() => checkProducts(products, new Set(photos.keys())), [products, photos]);

  const wantsPhotos = products.some((p) => p.imageFiles.length > 0);
  const photosChosen = photos.size > 0;
  const referenced = useMemo(() => [...new Set(products.flatMap((p) => p.imageFiles.map(fileKey)))], [products]);
  const matchedCount = referenced.filter((k) => photos.has(k)).length;

  const blockedProducts = products.filter((p) => checks.get(p.handle)?.blocked);
  const ready = products.filter((p) => !checks.get(p.handle)?.blocked);
  const photosToAttach = ready.reduce((n, p) => n + (checks.get(p.handle)?.matched.length ?? 0), 0);
  const sizeCount = products.reduce((n, p) => n + p.variants.length, 0);

  const needsPhotoStep = wantsPhotos && !photosChosen;
  const blocked = !parsed || parsed.errors.length > 0 || ready.length === 0 || needsPhotoStep;

  const readSheetFile = async (file: File) => {
    setReadError(null);
    setParsed(null);
    setOutcomes(null);
    setFatal(null);
    setFileName(file.name);
    if (!/\.xlsx$/i.test(file.name)) {
      setReadError('Choose an Excel file (.xlsx). In Excel or Google Sheets: File → Save as / Download → .xlsx.');
      return;
    }
    try {
      const { readSheet } = await import('read-excel-file/browser');
      const rows = (await readSheet(file)) as unknown[][];
      setParsed(parseSheet(rows));
    } catch (e) {
      console.error('[import] read failed', e);
      setReadError('This file couldn’t be read. Make sure it is an .xlsx file and the products are on the first sheet.');
    }
  };

  const addPhotos = (fileList: FileList | null) => {
    // Copy now: the input is cleared right after, which empties the live FileList.
    const files = Array.from(fileList ?? []).filter(isImage);
    if (!files.length) return;
    setPhotos((prev) => {
      const next = new Map(prev);
      for (const f of files) next.set(fileKey(f.name), f);
      return next;
    });
  };

  const run = async () => {
    if (blocked) return;
    setRunning(true);
    setFatal(null);
    setOutcomes([]);
    const results: ImportOutcome[] = [];
    try {
      for (let start = 0; start < ready.length; start += BATCH) {
        const chunk = ready.slice(start, start + BATCH);
        setProgress({ done: start, total: ready.length, step: 'Uploading photos' });

        // Upload every photo of the batch at once, then hand each product its own.
        const jobs = chunk.flatMap((p) =>
          (checks.get(p.handle)?.matched ?? []).map((m) => ({ handle: p.handle, key: m.key, name: m.name }))
        );
        const uploadedByKey = new Map<string, { url: string; width: number | null; height: number | null }>();
        await mapLimit(jobs, UPLOAD_CONCURRENCY, async (job) => {
          const file = photos.get(job.key);
          if (!file) throw new Error(`The photo “${job.name}” is no longer available. Select the photos again.`);
          const img = await uploadImage(file, `import/${job.handle}`);
          uploadedByKey.set(`${job.handle}|${job.key}`, { url: img.url, width: img.width, height: img.height });
        });

        const items: ImportItem[] = chunk.map((p) => ({
          ...p,
          uploadedImages: (checks.get(p.handle)?.matched ?? []).flatMap((m) => {
            const img = uploadedByKey.get(`${p.handle}|${m.key}`);
            return img ? [img] : [];
          })
        }));

        setProgress({ done: start, total: ready.length, step: 'Saving products' });
        const res = await importProducts(items);
        if (!res.ok) throw new Error(res.error);
        results.push(...res.data);
        setOutcomes([...results]);
      }
      setProgress({ done: ready.length, total: ready.length, step: 'Done' });
      router.refresh();
    } catch (e) {
      setFatal(
        `${e instanceof Error ? e.message : 'The import stopped.'} Products listed below were saved; fix the problem and import the same file again — saved products are updated, not duplicated.`
      );
    } finally {
      setRunning(false);
    }
  };

  const created = outcomes?.filter((o) => o.result === 'created').length ?? 0;
  const updated = outcomes?.filter((o) => o.result === 'updated').length ?? 0;
  const attached = outcomes?.reduce((n, o) => n + (o.imagesAttached ?? 0), 0) ?? 0;
  const failed = outcomes?.filter((o) => o.result === 'failed') ?? [];
  const finished = progress?.step === 'Done' && !running;

  return (
    <Page
      title="Import products"
      backHref="/admin/products"
      secondaryActions={
        <a href="/templates/products-template.xlsx" download className="admin-btn-secondary inline-flex h-8 items-center rounded-lg px-3 font-semibold">
          Download template
        </a>
      }
    >
      <div className="flex flex-col gap-4">
        <Card title="1. Spreadsheet">
          <p className="mb-3 text-admin-subdued">
            An Excel file (.xlsx), one product per row. <strong>Title</strong> and <strong>Price</strong> are required;{' '}
            <strong>Collections</strong> sets the category and <strong>Image files</strong> lists the photo names. A product whose
            Handle already exists is updated, never duplicated.
          </p>
          <input
            ref={sheetInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readSheetFile(f);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={running} onClick={() => sheetInput.current?.click()}>
              {fileName ? 'Choose another file' : 'Choose Excel file'}
            </Button>
            {fileName && <span className="text-admin-subdued">{fileName}</span>}
          </div>
          {readError && (
            <div className="mt-3">
              <Banner tone="critical">{readError}</Banner>
            </div>
          )}
          {parsed && parsed.errors.length > 0 && (
            <div className="mt-3">
              <Banner tone="critical" title="Fix these rows in the file, then choose it again">
                <ul className="list-disc pl-5">
                  {parsed.errors.slice(0, 30).map((e) => <li key={e}>{e}</li>)}
                  {parsed.errors.length > 30 && <li>…and {parsed.errors.length - 30} more.</li>}
                </ul>
              </Banner>
            </div>
          )}
          {parsed && parsed.warnings.length > 0 && (
            <div className="mt-3">
              <Banner tone="warning" title="Worth a look (the import can still run)">
                <ul className="list-disc pl-5">
                  {parsed.warnings.slice(0, 20).map((e) => <li key={e}>{e}</li>)}
                </ul>
              </Banner>
            </div>
          )}
          {parsed && !parsed.errors.length && (
            <p className="mt-3 font-medium">
              {products.length} product{products.length === 1 ? '' : 's'} found
              {sizeCount > products.length ? `, ${sizeCount} sizes in total` : ''}
              {referenced.length ? `, ${referenced.length} photos named` : ''}.
            </p>
          )}
        </Card>

        {parsed && !parsed.errors.length && referenced.length > 0 && (
          <Card title="2. Photos">
            <p className="mb-3 text-admin-subdued">
              Choose the folder holding the photos named in the <strong>Image files</strong> column — all of them at once. Nothing is
              uploaded yet: the photos are matched by file name and shown below first.
            </p>
            <input
              ref={folderInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={running} onClick={() => folderInput.current?.click()}>
                Choose photo folder
              </Button>
              <Button disabled={running} onClick={() => photoInput.current?.click()}>
                {photos.size ? 'Add more photos' : 'Or pick photos one by one'}
              </Button>
              {photosChosen && (
                <span className={matchedCount === referenced.length ? 'font-medium text-admin-success-text' : 'text-admin-subdued'}>
                  {matchedCount} of {referenced.length} photos matched
                </span>
              )}
            </div>
            {photosChosen && matchedCount < referenced.length && (
              <div className="mt-3">
                <Banner tone="critical" title={`${referenced.length - matchedCount} photos are missing`}>
                  The products using them are marked in red below and will not be imported. Check the folder, or fix the file names in
                  the sheet so they match exactly.
                </Banner>
              </div>
            )}
          </Card>
        )}

        {products.length > 0 && !parsed?.errors.length && (
          <Card title="3. Check and import" flush>
            <div className="max-h-[560px] overflow-y-auto border-t border-admin-border">
              <table className="admin-table w-full">
                <thead className="sticky top-0">
                  <tr>
                    <th>Handle</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Photos</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <PreviewRow
                      key={p.handle}
                      product={p}
                      check={checks.get(p.handle)!}
                      previews={previews}
                      photosChosen={photosChosen}
                      currency={currency}
                      outcome={outcomes?.find((o) => o.handle === p.handle)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-border px-4 py-3">
              <span className="text-admin-subdued">
                {running && progress
                  ? `${progress.step}… ${progress.done} of ${progress.total} products saved`
                  : finished
                    ? `Finished: ${created} created, ${updated} updated, ${attached} photos attached${failed.length ? `, ${failed.length} failed` : ''}.`
                    : needsPhotoStep
                      ? 'Choose the photo folder above first.'
                      : `${ready.length} product${ready.length === 1 ? '' : 's'} and ${photosToAttach} photos will be saved${blockedProducts.length ? `; ${blockedProducts.length} skipped` : ''}. Nothing is saved until you click Import.`}
              </span>
              <div className="flex gap-2">
                {finished && (
                  <ButtonLink href="/admin/products" variant="secondary">
                    View products
                  </ButtonLink>
                )}
                <Button variant="primary" disabled={blocked || running} onClick={run}>
                  {running ? 'Importing…' : finished ? 'Import again' : `Import ${ready.length} product${ready.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {blockedProducts.length > 0 && photosChosen && (
          <Banner tone="critical" title={`${blockedProducts.length} product${blockedProducts.length === 1 ? '' : 's'} will be skipped`}>
            <ul className="list-disc pl-5">
              {blockedProducts.slice(0, 20).map((p) => {
                const c = checks.get(p.handle)!;
                return (
                  <li key={p.handle}>
                    <strong>{p.handle}</strong>:{' '}
                    {c.missingPhotos.length > 0 && <>photo not found: {c.missingPhotos.map((n) => `“${n}”`).join(', ')}. </>}
                    {c.duplicatePhotos.length > 0 && <>also used by another product: {c.duplicatePhotos.map((n) => `“${n}”`).join(', ')}.</>}
                  </li>
                );
              })}
              {blockedProducts.length > 20 && <li>…and {blockedProducts.length - 20} more.</li>}
            </ul>
          </Banner>
        )}

        {fatal && <Banner tone="critical" title="The import stopped">{fatal}</Banner>}

        {finished && (
          <Banner tone={failed.length ? 'warning' : 'success'} title="Import summary">
            <ul className="list-disc pl-5">
              <li>{created} product{created === 1 ? '' : 's'} created</li>
              <li>{updated} product{updated === 1 ? '' : 's'} updated</li>
              <li>{attached} photo{attached === 1 ? '' : 's'} attached</li>
              {blockedProducts.length > 0 && <li>{blockedProducts.length} skipped because of a photo problem (listed above)</li>}
              {failed.length > 0 && <li>{failed.length} failed (listed below)</li>}
            </ul>
          </Banner>
        )}

        {failed.length > 0 && (
          <Banner tone="critical" title={`${failed.length} product${failed.length === 1 ? '' : 's'} couldn’t be saved`}>
            <ul className="list-disc pl-5">
              {failed.map((f) => (
                <li key={f.handle}>
                  <strong>{f.handle}</strong>: {f.message}
                </li>
              ))}
            </ul>
          </Banner>
        )}
      </div>
    </Page>
  );
}

function PreviewRow({
  product: p,
  check,
  previews,
  photosChosen,
  currency,
  outcome
}: {
  product: ImportProduct;
  check: { missingPhotos: string[]; duplicatePhotos: string[]; matched: { name: string; key: string }[]; blocked: boolean };
  previews: Map<string, string>;
  photosChosen: boolean;
  currency: string;
  outcome?: ImportOutcome;
}) {
  const bad = photosChosen && check.blocked;
  return (
    <tr className={bad ? 'bg-[#fff0f0]' : undefined}>
      <td className="align-top font-mono text-[12px] text-admin-subdued">{p.handle}</td>
      <td className="align-top">
        <div className="font-medium">{p.title}</div>
        {p.brand && <div className="text-admin-subdued">{p.brand}</div>}
      </td>
      <td className="align-top">
        {p.collections.length ? (
          <div className="flex flex-wrap gap-1">
            {p.collections.map((c) => (
              <Badge key={c} tone="info">
                {c}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-admin-critical">No category</span>
        )}
      </td>
      <td className="align-top">
        <div className="flex flex-wrap items-center gap-1">
          {p.imageFiles.map((name) => {
            const key = fileKey(name);
            const url = previews.get(key);
            const missing = check.missingPhotos.includes(name);
            const duplicate = check.duplicatePhotos.includes(name);
            return url && !duplicate ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={name}
                src={url}
                alt={name}
                title={name}
                className="h-11 w-11 rounded-md border border-admin-border object-cover"
              />
            ) : (
              <span
                key={name}
                title={name}
                className={`flex h-11 w-11 items-center justify-center rounded-md border text-[16px] ${
                  photosChosen && (missing || duplicate)
                    ? 'border-admin-critical bg-white text-admin-critical'
                    : 'border-dashed border-admin-border text-admin-subdued'
                }`}
              >
                {photosChosen && duplicate ? '!' : photosChosen && missing ? '✕' : '·'}
              </span>
            );
          })}
          {p.imageFiles.length === 0 && <span className="text-admin-subdued">None</span>}
        </div>
        {bad && (
          <ul className="mt-1 text-[12px] text-admin-critical">
            {check.missingPhotos.map((n) => (
              <li key={n}>Not found: {n}</li>
            ))}
            {check.duplicatePhotos.map((n) => (
              <li key={n}>Used by another product: {n}</li>
            ))}
          </ul>
        )}
      </td>
      <td className="whitespace-nowrap align-top">
        {p.variants.map((v) => (
          <div key={v.size ?? 'one'}>
            {v.size ? `${v.size}: ` : ''}
            {formatMoney(v.price, currency)}
          </div>
        ))}
      </td>
      <td className="align-top">
        {outcome ? (
          outcome.result === 'failed' ? (
            <Badge tone="critical">Failed</Badge>
          ) : (
            <Badge tone="success">{outcome.result === 'created' ? 'Created' : 'Updated'}</Badge>
          )
        ) : bad ? (
          <Badge tone="critical">Skipped</Badge>
        ) : p.status === 'draft' ? (
          <Badge tone="info">Draft</Badge>
        ) : (
          <Badge>Active</Badge>
        )}
      </td>
    </tr>
  );
}

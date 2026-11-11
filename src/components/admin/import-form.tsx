'use client';

import { uploadImage } from '@/components/admin/inputs';
import { Badge, Banner, Button, ButtonLink, Card, Page, Thumbnail } from '@/components/admin/ui';
import { importProducts, type ImportItem, type ImportOutcome } from '@/lib/admin/actions/import';
import { fileKey, parseSheet, type ParseResult } from '@/lib/admin/import-sheet';
import { formatMoney } from '@/lib/admin/format';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Products saved per server request; photos for that batch are uploaded first. */
const BATCH = 10;
const UPLOAD_CONCURRENCY = 4;

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

  // Local previews of the selected photos (freed when the selection changes).
  const previews = useMemo(() => {
    const m = new Map<string, string>();
    photos.forEach((file, key) => m.set(key, URL.createObjectURL(file)));
    return m;
  }, [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const products = useMemo(() => parsed?.products ?? [], [parsed]);
  const referenced = useMemo(() => [...new Set(products.flatMap((p) => p.imageFiles.map(fileKey)))], [products]);
  const missing = referenced.filter((k) => !photos.has(k));
  const sizeCount = products.reduce((n, p) => n + p.variants.length, 0);
  const blocked = !parsed || parsed.errors.length > 0 || products.length === 0;

  const readSheetFile = async (file: File) => {
    setReadError(null);
    setParsed(null);
    setOutcomes(null);
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
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(f.name));
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
      for (let start = 0; start < products.length; start += BATCH) {
        const chunk = products.slice(start, start + BATCH);
        setProgress({ done: start, total: products.length, step: 'Uploading photos' });

        const items: ImportItem[] = await mapLimit(chunk, UPLOAD_CONCURRENCY, async (p) => {
          const uploadedImages: ImportItem['uploadedImages'] = [];
          for (const name of p.imageFiles) {
            const file = photos.get(fileKey(name));
            if (!file) continue;
            const img = await uploadImage(file, `import/${p.handle}`);
            uploadedImages.push({ url: img.url, width: img.width, height: img.height });
          }
          return { ...p, uploadedImages };
        });

        setProgress({ done: start, total: products.length, step: 'Saving products' });
        const res = await importProducts(items);
        if (!res.ok) throw new Error(res.error);
        results.push(...res.data);
        setOutcomes([...results]);
      }
      setProgress({ done: products.length, total: products.length, step: 'Done' });
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
  const failed = outcomes?.filter((o) => o.result === 'failed') ?? [];
  const finished = progress?.step === 'Done' && !running;

  return (
    <Page
      title="Import products"
      backHref="/admin/products"
      narrow
      secondaryActions={
        <a href="/templates/products-template.xlsx" download className="admin-btn-secondary inline-flex h-8 items-center rounded-lg px-3 font-semibold">
          Download template
        </a>
      }
    >
      <div className="flex flex-col gap-4">
        <Card title="1. Spreadsheet">
          <p className="mb-3 text-admin-subdued">
            An Excel file (.xlsx) with one product per row. Only <strong>Title</strong> and <strong>Price</strong> are required. Products
            whose Handle already exists are updated instead of duplicated.
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
              {sizeCount > products.length ? `, ${sizeCount} sizes in total` : ''}.
            </p>
          )}
        </Card>

        {parsed && referenced.length > 0 && (
          <Card title="2. Photos">
            <p className="mb-3 text-admin-subdued">
              Select the photos named in the sheet’s <strong>Image files</strong> column. You can select the whole folder’s photos at
              once (Ctrl+A / Cmd+A in the file window); extra photos are ignored.
            </p>
            <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={running} onClick={() => photoInput.current?.click()}>
                {photos.size ? 'Add more photos' : 'Choose photos'}
              </Button>
              <span className={missing.length ? 'text-admin-subdued' : 'font-medium text-admin-success-text'}>
                {referenced.length - missing.length} of {referenced.length} photos matched
              </span>
            </div>
            {missing.length > 0 && photos.size > 0 && (
              <div className="mt-3">
                <Banner tone="warning" title={`${missing.length} photo${missing.length === 1 ? '' : 's'} not selected yet`}>
                  Products without their photo are imported without it (and left out of Google Shopping until you add one).
                  <ul className="mt-1 list-disc pl-5">
                    {missing.slice(0, 10).map((m) => <li key={m}>{m}</li>)}
                    {missing.length > 10 && <li>…and {missing.length - 10} more.</li>}
                  </ul>
                </Banner>
              </div>
            )}
          </Card>
        )}

        {products.length > 0 && !parsed?.errors.length && (
          <Card title={`3. Check and import`} flush>
            <div className="max-h-[480px] overflow-y-auto border-t border-admin-border">
              <table className="admin-table w-full">
                <thead className="sticky top-0">
                  <tr>
                    <th className="w-14" />
                    <th>Product</th>
                    <th>Sizes &amp; price</th>
                    <th>Photos</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const keys = p.imageFiles.map(fileKey);
                    const have = keys.filter((k) => photos.has(k)).length + p.imageUrls.length;
                    const want = keys.length + p.imageUrls.length;
                    const outcome = outcomes?.find((o) => o.handle === p.handle);
                    return (
                      <tr key={p.handle}>
                        <td>
                          <Thumbnail src={previews.get(keys.find((k) => previews.has(k)) ?? '') ?? p.imageUrls[0] ?? null} size={40} />
                        </td>
                        <td>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-admin-subdued">{[p.brand, p.gender].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="whitespace-nowrap">
                          {p.variants.map((v) => (
                            <div key={v.size ?? 'one'}>
                              {v.size ? `${v.size}: ` : ''}
                              {formatMoney(v.price, currency)}
                            </div>
                          ))}
                        </td>
                        <td>{want === 0 ? <span className="text-admin-subdued">None</span> : `${have} of ${want}`}</td>
                        <td>
                          {outcome ? (
                            outcome.result === 'failed' ? (
                              <Badge tone="critical">Failed</Badge>
                            ) : (
                              <Badge tone="success">{outcome.result === 'created' ? 'Created' : 'Updated'}</Badge>
                            )
                          ) : p.status === 'draft' ? (
                            <Badge tone="info">Draft</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-border px-4 py-3">
              <span className="text-admin-subdued">
                {progress && running
                  ? `${progress.step}… ${progress.done} of ${progress.total} products saved`
                  : finished
                    ? `Finished: ${created} created, ${updated} updated${failed.length ? `, ${failed.length} failed` : ''}.`
                    : 'Nothing is saved until you click Import.'}
              </span>
              <div className="flex gap-2">
                {finished && (
                  <ButtonLink href="/admin/products" variant="secondary">
                    View products
                  </ButtonLink>
                )}
                <Button variant="primary" disabled={blocked || running} onClick={run}>
                  {running ? 'Importing…' : finished ? 'Import again' : `Import ${products.length} product${products.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {fatal && <Banner tone="critical" title="The import stopped">{fatal}</Banner>}
        {failed.length > 0 && (
          <Banner tone="critical" title={`${failed.length} product${failed.length === 1 ? '' : 's'} couldn’t be saved`}>
            <ul className="list-disc pl-5">
              {failed.map((f) => (
                <li key={f.handle}>
                  {f.title}: {f.message}
                </li>
              ))}
            </ul>
          </Banner>
        )}
      </div>
    </Page>
  );
}

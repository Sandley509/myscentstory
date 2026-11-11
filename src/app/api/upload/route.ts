import { createServiceClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic'
};

/**
 * Customer photo uploads (custom mugs / printed gifts).
 * Stores the file in the public `customer-uploads` bucket and returns its URL,
 * which is attached to the cart line and shows up on the order in /admin.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'Uploads are not configured.' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Please upload a JPG, PNG or WebP image.' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is larger than 10MB.' }, { status: 413 });
  }

  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const db = createServiceClient();
  const { error } = await db.storage
    .from('customer-uploads')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error('[upload] storage error:', error.message);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  const { data } = db.storage.from('customer-uploads').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}

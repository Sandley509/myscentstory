import { revalidate } from '@/lib/commerce';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return revalidate(req);
}

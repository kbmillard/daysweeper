import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addProductTypeOption, getProductTypeOptions } from '@/lib/product-types-kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const types = await getProductTypeOptions();
    return NextResponse.json({ types });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load product types';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const name = body?.name;
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    const types = await addProductTypeOption(name);
    return NextResponse.json({ types });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add product type';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

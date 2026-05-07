import { NextResponse } from 'next/server';
import { resolveApiUserIdOr401 } from '@/lib/clerk-api-optional';
import { addProductTypeOption, getProductTypeOptions } from '@/lib/product-types-kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const gate = await resolveApiUserIdOr401();
    if (!gate.ok) return gate.response;
    const types = await getProductTypeOptions();
    return NextResponse.json({ types });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load product types';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await resolveApiUserIdOr401();
    if (!gate.ok) return gate.response;
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

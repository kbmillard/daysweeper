import { prisma } from '@/lib/prisma';

export const PRODUCT_TYPES_META_KEY = 'product_types_list';

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim());
}

export async function getProductTypeOptions(): Promise<string[]> {
  const row = await prisma.metaKV.findUnique({
    where: { key: PRODUCT_TYPES_META_KEY }
  });
  const list = normalizeList(row?.value);
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

export async function addProductTypeOption(name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Product type name is required');
  }
  const next = Array.from(
    new Set([...(await getProductTypeOptions()), trimmed])
  ).sort((a, b) => a.localeCompare(b));
  await prisma.metaKV.upsert({
    where: { key: PRODUCT_TYPES_META_KEY },
    create: { key: PRODUCT_TYPES_META_KEY, value: next },
    update: { value: next }
  });
  return next;
}

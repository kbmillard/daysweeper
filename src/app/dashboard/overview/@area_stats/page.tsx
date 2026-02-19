import { CompanyAreaGraph } from '@/features/overview/components/company-area-graph';
import { prisma } from '@/lib/prisma';

function safeKey(category: string) {
  return category.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export default async function AreaStats() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Same top categories as pie chart: groupBy category, top 5 by count
  const topCategories = await prisma.company.groupBy({
    by: ['category'],
    _count: { id: true },
    where: { category: { not: null } }
  });
  const categoryOrder = topCategories
    .sort((a, b) => (b._count.id ?? 0) - (a._count.id ?? 0))
    .slice(0, 5)
    .map((c) => c.category as string);

  const companies = await prisma.company.findMany({
    where: {
      createdAt: { gte: sixMonthsAgo },
      ...(categoryOrder.length > 0 ? { category: { in: categoryOrder } } : {})
    },
    select: { createdAt: true, category: true }
  });

  // Build one row per month, with a count per category (same keys as pie)
  const monthMap = new Map<string, Record<string, number>>();
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const row: Record<string, string | number> = { month: monthName };
    categoryOrder.forEach((cat) => {
      row[safeKey(cat)] = 0;
    });
    monthMap.set(monthKey, row as Record<string, number>);
  }

  companies.forEach((company) => {
    if (!company.category) return;
    const date = new Date(company.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const row = monthMap.get(monthKey);
    if (!row) return;
    const key = safeKey(company.category);
    if (key in row) row[key] = (row[key] as number) + 1;
  });

  const chartData = Array.from(monthMap.values());
  const categories = categoryOrder.map((label) => ({ key: safeKey(label), label }));

  return <CompanyAreaGraph data={chartData} categories={categories} />;
}


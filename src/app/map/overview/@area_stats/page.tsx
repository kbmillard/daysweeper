import { CompanyAreaGraph } from '@/features/overview/components/company-area-graph';
import { COMPANY_STATUSES, normalizeStatus } from '@/constants/company-status';
import { prisma } from '@/lib/prisma';

function safeKey(status: string) {
  return status.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export default async function AreaStats() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const companies = await prisma.company.findMany({
    where: {
      createdAt: { gte: sixMonthsAgo },
      status: { not: null }
    },
    select: { createdAt: true, status: true }
  });

  const monthMap = new Map<string, Record<string, string | number>>();
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const row: Record<string, string | number> = { month: monthName };
    COMPANY_STATUSES.forEach((status) => {
      row[safeKey(status)] = 0;
    });
    monthMap.set(monthKey, row);
  }

  companies.forEach((company) => {
    if (!company.status) return;
    const normalized = normalizeStatus(company.status);
    if (!normalized) return;
    const date = new Date(company.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const row = monthMap.get(monthKey);
    if (!row) return;
    const key = safeKey(normalized);
    if (key in row) row[key] = (row[key] as number) + 1;
  });

  const chartData = Array.from(monthMap.values());
  const categories = COMPANY_STATUSES.map((label) => ({ key: safeKey(label), label }));

  return <CompanyAreaGraph data={chartData} categories={categories} />;
}

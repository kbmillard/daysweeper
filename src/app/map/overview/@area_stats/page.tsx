import { CompanyAreaGraph } from '@/features/overview/components/company-area-graph';
import { prisma } from '@/lib/prisma';

export default async function AreaStats() {
  // Get leads added over the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const companies = await prisma.company.findMany({
    where: {
      createdAt: {
        gte: sixMonthsAgo
      }
    },
    select: {
      createdAt: true,
      category: true,
      segment: true
    }
  });

  // Group by month
  const monthMap = new Map<string, { month: string; withCategory: number; withSegment: number }>();

  companies.forEach((company) => {
    const date = new Date(company.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthMap.has(monthKey)) {
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      monthMap.set(monthKey, { month: monthName, withCategory: 0, withSegment: 0 });
    }
    
    const entry = monthMap.get(monthKey)!;
    if (company.category) entry.withCategory++;
    if (company.segment) entry.withSegment++;
  });

  // Fill in all 6 months and sort
  const chartData: { month: string; withCategory: number; withSegment: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    
    const entry = monthMap.get(monthKey) || { month: monthName, withCategory: 0, withSegment: 0 };
    chartData.push(entry);
  }

  return <CompanyAreaGraph data={chartData} />;
}


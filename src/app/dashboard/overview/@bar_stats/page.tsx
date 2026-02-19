import { CompanyBarGraph } from '@/features/overview/components/company-bar-graph';
import { prisma } from '@/lib/prisma';

export default async function BarStats() {
  // Get companies grouped by category for the last 3 months
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const companies = await prisma.company.findMany({
    where: {
      createdAt: {
        gte: threeMonthsAgo
      }
    },
    select: {
      createdAt: true,
      category: true,
      segment: true
    }
  });

  // Group by date and category
  const dataMap = new Map<string, { date: string; category: number; segment: number }>();

  companies.forEach((company) => {
    const date = new Date(company.createdAt).toISOString().split('T')[0];
    const key = date;
    
    if (!dataMap.has(key)) {
      dataMap.set(key, { date, category: 0, segment: 0 });
    }
    
    const entry = dataMap.get(key)!;
    if (company.category) entry.category++;
    if (company.segment) entry.segment++;
  });

  // Fill in missing dates and sort
  const chartData = Array.from(dataMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  return <CompanyBarGraph data={chartData} />;
}


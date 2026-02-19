import { CompanyPieGraph } from '@/features/overview/components/company-pie-graph';
import { prisma } from '@/lib/prisma';

export default async function Stats() {
  // Get companies grouped by category
  const companies = await prisma.company.groupBy({
    by: ['category'],
    _count: {
      id: true
    },
    where: {
      category: {
        not: null
      }
    }
  });

  const chartData = companies
    .map((c) => ({
      category: c.category || 'Uncategorized',
      count: c._count.id,
      fill: 'var(--primary)'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 categories

  return <CompanyPieGraph data={chartData} />;
}


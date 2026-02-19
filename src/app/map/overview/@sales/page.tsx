import { RecentCompanies } from '@/features/overview/components/recent-companies';
import { prisma } from '@/lib/prisma';

export default async function Sales() {
  const recentCompanies = await prisma.company.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      website: true,
      email: true,
      createdAt: true
    }
  });

  return <RecentCompanies companies={recentCompanies} />;
}

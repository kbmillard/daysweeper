import { RecentCompanies } from '@/features/overview/components/recent-companies';
import { prisma } from '@/lib/prisma';

export default async function Sales() {
  const recentCompanies = await prisma.company.findMany({
    where: { hidden: false, Location: { some: {} }, status: 'Contacted - meeting set' },
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

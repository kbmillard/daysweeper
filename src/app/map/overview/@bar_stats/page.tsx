import { LeadsAddedCard } from '@/features/overview/components/leads-added-card';
import { prisma } from '@/lib/prisma';

export default async function BarStats() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const total = await prisma.company.count({
    where: {
      createdAt: {
        gte: threeMonthsAgo
      }
    }
  });

  return <LeadsAddedCard total={total} />;
}


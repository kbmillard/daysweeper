import { CompanyAreaGraphLazy } from '@/features/overview/components/company-area-graph-lazy';
import { buildAccountGrowthAreaData } from '@/lib/overview-account-growth';

export default async function AreaStats() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { chartData, categories } = await buildAccountGrowthAreaData({
    newCompanyWhere: {
      createdAt: { gte: sixMonthsAgo },
      status: { not: null }
    },
    locationCompanyWhere: undefined
  });

  return <CompanyAreaGraphLazy data={chartData} categories={categories} />;
}

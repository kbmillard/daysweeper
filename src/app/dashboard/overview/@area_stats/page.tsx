import { CompanyAreaGraphLazy } from '@/features/overview/components/company-area-graph-lazy';
import { buildAccountGrowthAreaData } from '@/lib/overview-account-growth';

export default async function AreaStats() {
  const { chartData, categories } = await buildAccountGrowthAreaData({
    newCompanyWhere: { hidden: false, Location: { some: {} } },
    locationCompanyWhere: { hidden: false }
  });

  return <CompanyAreaGraphLazy data={chartData} categories={categories} />;
}

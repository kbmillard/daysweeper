import PageContainer from '@/components/layout/page-container';
import { CompaniesTable } from '@/components/companies/CompaniesTable';

export default function CompaniesPage() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>Companies</h2>
        </div>
        <CompaniesTable />
      </div>
    </PageContainer>
  );
}

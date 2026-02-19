import DashboardMapClient from './dashboard-map-client';

export const metadata = {
  title: 'Dashboard: Overview'
};

export default function OverviewPage() {
  return (
    <div className='space-y-4'>
      <DashboardMapClient />
    </div>
  );
}

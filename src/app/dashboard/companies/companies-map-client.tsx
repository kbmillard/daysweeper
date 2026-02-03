'use client';

import dynamic from 'next/dynamic';

const CompaniesMap = dynamic(() => import('./companies-map'), { ssr: false });

export default function CompaniesMapClient() {
  return <CompaniesMap />;
}

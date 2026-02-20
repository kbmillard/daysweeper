import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import Link from 'next/link';
import { Building2 } from 'lucide-react';

type Company = {
  id: string;
  name: string;
  website: string | null;
  email: string | null;
  createdAt: Date;
};

export function RecentCompanies({ companies }: { companies: Company[] }) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Contacted - Meeting Set</CardTitle>
        <CardDescription>
          {companies.length} accounts with meeting set
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {companies.length === 0 ? (
            <div className='text-center text-muted-foreground py-8'>
              No accounts with meeting set
            </div>
          ) : (
            companies.map((company) => (
              <Link
                key={company.id}
                href={`/map/companies/${company.id}`}
                className='flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors'
              >
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary/10'>
                  <Building2 className='h-5 w-5 text-primary' />
                </div>
                <div className='flex-1 space-y-1'>
                  <p className='text-sm leading-none font-medium'>{company.name}</p>
                  <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                    {company.email && <span>{company.email}</span>}
                    {company.website && (
                      <>
                        {company.email && <span>•</span>}
                        <span className='truncate max-w-[200px]'>{company.website.replace(/^https?:\/\//, '')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className='text-xs text-muted-foreground'>
                  {new Date(company.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

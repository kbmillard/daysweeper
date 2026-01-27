'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Text, Mail, Phone, Globe } from 'lucide-react';
import Link from 'next/link';

type Company = {
  id: string;
  company: string;
  addressRaw: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  segment: string | null;
  tier: string | null;
  accountState: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const columns: ColumnDef<Company>[] = [
  {
    id: 'company',
    accessorKey: 'company',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Company' />
    ),
    cell: ({ row }) => {
      const company = row.original;
      return (
        <div className='flex flex-col'>
          <Link
            href={`/dashboard/companies/${company.id}`}
            className='font-medium hover:underline'
          >
            {company.company}
          </Link>
          {company.addressRaw && (
            <span className='text-xs text-muted-foreground'>
              {company.addressRaw}
            </span>
          )}
        </div>
      );
    },
    meta: {
      label: 'Company',
      placeholder: 'Search companies...',
      variant: 'text',
      icon: Text
    },
    enableColumnFilter: true
  },
  {
    id: 'contact',
    header: 'Contact',
    cell: ({ row }) => {
      const company = row.original;
      return (
        <div className='flex flex-col gap-1 text-sm'>
          {company.email && (
            <div className='flex items-center gap-1'>
              <Mail className='h-3 w-3 text-muted-foreground' />
              <span className='text-xs'>{company.email}</span>
            </div>
          )}
          {company.phone && (
            <div className='flex items-center gap-1'>
              <Phone className='h-3 w-3 text-muted-foreground' />
              <span className='text-xs'>{company.phone}</span>
            </div>
          )}
          {company.website && (
            <div className='flex items-center gap-1'>
              <Globe className='h-3 w-3 text-muted-foreground' />
              <a
                href={company.website}
                target='_blank'
                rel='noopener noreferrer'
                className='text-xs text-primary hover:underline'
              >
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>
      );
    }
  },
  {
    id: 'segment',
    accessorKey: 'segment',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Segment' />
    ),
    cell: ({ cell }) => {
      const segment = cell.getValue<Company['segment']>();
      return segment ? (
        <Badge variant='outline' className='capitalize'>
          {segment}
        </Badge>
      ) : (
        <span className='text-muted-foreground'>—</span>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Segment',
      variant: 'text',
      icon: Text
    }
  },
  {
    id: 'tier',
    accessorKey: 'tier',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Tier' />
    ),
    cell: ({ cell }) => {
      const tier = cell.getValue<Company['tier']>();
      return tier ? (
        <Badge variant='secondary' className='capitalize'>
          {tier}
        </Badge>
      ) : (
        <span className='text-muted-foreground'>—</span>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Tier',
      variant: 'text',
      icon: Text
    }
  },
  {
    id: 'accountState',
    accessorKey: 'accountState',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ cell }) => {
      const state = cell.getValue<Company['accountState']>();
      if (!state) return <span className='text-muted-foreground'>—</span>;
      
      const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
        ACCOUNT: 'default',
        NEW_UNCONTACTED: 'outline',
        NEW_CONTACTED_NO_ANSWER: 'secondary'
      };
      
      return (
        <Badge variant={variants[state] || 'outline'} className='capitalize'>
          {state.replace(/_/g, ' ')}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Status',
      variant: 'text',
      icon: Text
    }
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Created' />
    ),
    cell: ({ cell }) => {
      const date = cell.getValue<Date>();
      return (
        <span className='text-sm text-muted-foreground'>
          {new Date(date).toLocaleDateString()}
        </span>
      );
    }
  }
];

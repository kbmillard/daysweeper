'use client';
import type { Option } from '@/types/data-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Text, Globe, MapPin } from 'lucide-react';
import Link from 'next/link';
import { CellAction } from './cell-action';

type Company = {
  id: string;
  name: string;
  website: string | null;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
  Location: Array<{
    addressRaw: string;
    addressComponents: any;
  }>;
};

export function getColumns(options?: {
  stateOptions?: Option[];
}): ColumnDef<Company>[] {
  const stateOptions = options?.stateOptions ?? [];

  return [
    {
      id: 'name',
      accessorKey: 'name',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Company' />
      ),
      cell: ({ row }) => {
        const company = row.original;
        const primaryLocation = company.Location?.[0];
        return (
          <div className='flex flex-col'>
            <Link
              href={`/dashboard/companies/${company.id}`}
              className='font-medium hover:underline'
            >
              {company.name}
            </Link>
            {primaryLocation?.addressRaw && (
              <span className='text-xs text-muted-foreground'>
                {primaryLocation.addressRaw}
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
      id: 'address',
      accessorFn: (row) => row.Location?.[0]?.addressRaw || '',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Address' />
      ),
      cell: ({ row }) => {
        const company = row.original;
        const primaryLocation = company.Location?.[0];
        return primaryLocation?.addressRaw ? (
          <span className='text-sm text-muted-foreground max-w-[300px] truncate block'>
            {primaryLocation.addressRaw}
          </span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: 'Address',
        placeholder: 'Search address...',
        variant: 'text',
        icon: MapPin
      },
      enableColumnFilter: true
    },
    {
      id: 'state',
      accessorFn: (row) =>
        (row.Location?.[0]?.addressComponents as { state?: string } | null)?.state ?? '',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='State' />
      ),
      cell: ({ row }) => {
        const state = (row.original.Location?.[0]?.addressComponents as { state?: string } | null)?.state;
        return state ? (
          <span className='text-sm'>{state}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: 'State',
        variant: 'select',
        options: stateOptions,
        icon: MapPin
      },
      enableColumnFilter: false
    },
    {
      id: 'website',
      accessorKey: 'website',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Website' />
      ),
      cell: ({ row }) => {
        const company = row.original;
        return company.website ? (
          <div className='flex items-center gap-1 text-sm'>
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
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      enableColumnFilter: false
    },
    {
      id: 'status',
      accessorKey: 'status',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ cell }) => {
        const status = cell.getValue<Company['status']>();
        return status ? (
          <Badge variant='outline' className='text-xs'>
            {status}
          </Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      enableColumnFilter: false
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="text-xs">Actions</span>,
      cell: ({ row }) => (
        <CellAction companyId={row.original.id} companyName={row.original.name} />
      ),
      size: 200,
      minSize: 200
    }
  ];
}

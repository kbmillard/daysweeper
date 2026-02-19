'use client';
import type { Option } from '@/types/data-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Text, Globe, MapPin, Tags } from 'lucide-react';
import Link from 'next/link';

type Company = {
  id: string;
  name: string;
  website: string | null;
  status: string | null;
  subtype: string | null;
  subtypeGroup: string | null;
  createdAt: Date;
  updatedAt: Date;
  Location: Array<{
    addressRaw: string;
    addressComponents: any;
  }>;
};

export function getColumns(options: {
  stateOptions: Option[];
  subCategoryOptions: Option[];
  subCategoryGroupOptions: Option[];
}): ColumnDef<Company>[] {
  const { stateOptions, subCategoryOptions, subCategoryGroupOptions } = options;

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
      accessorFn: (row) => row.Location?.[0]?.addressRaw ?? null,
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Address' />
      ),
      cell: ({ row }) => {
        const company = row.original;
        const primaryLocation = company.Location?.[0];
        return primaryLocation?.addressRaw ? (
          <span className='text-sm'>{primaryLocation.addressRaw}</span>
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
      accessorFn: () => undefined,
      enableSorting: false,
      enableHiding: true,
      header: () => null,
      cell: () => null,
      meta: {
        label: 'State',
        variant: 'select',
        options: stateOptions,
        icon: MapPin
      },
      enableColumnFilter: true
    },
    {
      id: 'subCategory',
      accessorFn: () => undefined,
      enableSorting: false,
      enableHiding: true,
      header: () => null,
      cell: () => null,
      meta: {
        label: 'Sub category',
        variant: 'select',
        options: subCategoryOptions,
        icon: Tags
      },
      enableColumnFilter: true
    },
    {
      id: 'subCategoryGroup',
      accessorFn: () => undefined,
      enableSorting: false,
      enableHiding: true,
      header: () => null,
      cell: () => null,
      meta: {
        label: 'Sub category group',
        variant: 'select',
        options: subCategoryGroupOptions,
        icon: Tags
      },
      enableColumnFilter: true
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
      id: 'locations',
      accessorFn: (row) => row.Location?.length || 0,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Locations' />
      ),
      cell: ({ row }) => {
        const company = row.original;
        const locationCount = company.Location?.length || 0;
        return locationCount > 0 ? (
          <Badge variant='outline'>{locationCount} location{locationCount !== 1 ? 's' : ''}</Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      enableSorting: true,
      enableColumnFilter: false
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      enableSorting: true,
      enableHiding: true,
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
      },
      enableColumnFilter: false
    }
  ];
}

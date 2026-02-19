'use client';
import type { Option } from '@/types/data-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Text, Globe, MapPin, Tags, Layers, Folder } from 'lucide-react';
import Link from 'next/link';
import { CellAction } from './cell-action';

type Company = {
  id: string;
  name: string;
  website: string | null;
  status: string | null;
  tier: string | null;
  category: string | null;
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
  tierOptions: Option[];
  categoryOptions: Option[];
  subCategoryOptions: Option[];
  subCategoryGroupOptions: Option[];
}): ColumnDef<Company>[] {
  const { stateOptions, tierOptions, categoryOptions, subCategoryOptions, subCategoryGroupOptions } = options;

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
              href={`/map/companies/${company.id}`}
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
      enableColumnFilter: false
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
      enableColumnFilter: true
    },
    {
      id: 'tier',
      accessorKey: 'tier',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Tier' />
      ),
      cell: ({ row }) => {
        const value = row.original.tier;
        return value ? (
          <span className='text-sm'>{value}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: 'Tier',
        variant: 'select',
        options: tierOptions,
        icon: Layers
      },
      enableColumnFilter: true
    },
    {
      id: 'category',
      accessorKey: 'category',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Category' />
      ),
      cell: ({ row }) => {
        const value = row.original.category;
        return value ? (
          <span className='text-sm'>{value}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: 'Category',
        variant: 'select',
        options: categoryOptions,
        icon: Folder
      },
      enableColumnFilter: true
    },
    {
      id: 'subCategory',
      accessorKey: 'subtype',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Sub category' />
      ),
      cell: ({ row }) => {
        const value = row.original.subtype;
        return value ? (
          <span className='text-sm'>{value}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
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
      accessorKey: 'subtypeGroup',
      enableSorting: true,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Sub category group' />
      ),
      cell: ({ row }) => {
        const value = row.original.subtypeGroup;
        return value ? (
          <span className='text-sm'>{value}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
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

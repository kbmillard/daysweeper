'use client';
import type { Option } from '@/types/data-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Text, Globe, MapPin, Tags, Phone, Mail, Layers, Hash, Key, Building2 } from 'lucide-react';
import Link from 'next/link';

type Company = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  segment: string | null;
  category: string | null;
  subtype: string | null;
  subtypeGroup: string | null;
  companyKey: string | null;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
  Location: Array<{
    addressRaw: string;
    addressComponents: any;
  }>;
};

export function getColumns(options: {
  subCategoryOptions: Option[];
  subCategoryGroupOptions: Option[];
}): ColumnDef<Company>[] {
  const { subCategoryOptions, subCategoryGroupOptions } = options;

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
        return (
          <Link
            href={`/dashboard/companies/${company.id}`}
            className='font-medium hover:underline'
          >
            {company.name}
          </Link>
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
        const address = row.original.Location?.[0]?.addressRaw;
        return address ? (
          <div className='flex items-center gap-1'>
            <MapPin className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='text-xs text-muted-foreground'>{address}</span>
          </div>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: {
        label: 'Address',
        icon: MapPin
      },
      enableColumnFilter: false
    },
    {
      id: 'phone',
      accessorKey: 'phone',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Phone' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? (
          <div className='flex items-center gap-1'>
            <Phone className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='text-xs'>{val}</span>
          </div>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: { label: 'Phone', icon: Phone },
      enableColumnFilter: false
    },
    {
      id: 'email',
      accessorKey: 'email',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Email' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? (
          <div className='flex items-center gap-1'>
            <Mail className='h-3 w-3 shrink-0 text-muted-foreground' />
            <a href={`mailto:${val}`} className='text-xs text-primary hover:underline'>{val}</a>
          </div>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: { label: 'Email', icon: Mail },
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
      meta: { label: 'Website', icon: Globe },
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
      meta: { label: 'Status' },
      enableColumnFilter: false
    },
    {
      id: 'tier',
      accessorKey: 'tier',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Tier' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? (
          <Badge variant='secondary' className='text-xs'>{val}</Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: { label: 'Tier', icon: Layers },
      enableColumnFilter: false
    },
    {
      id: 'segment',
      accessorKey: 'segment',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Segment' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? <span className='text-xs'>{val}</span> : <span className='text-muted-foreground'>—</span>;
      },
      meta: { label: 'Segment', icon: Building2 },
      enableColumnFilter: false
    },
    {
      id: 'category',
      accessorKey: 'category',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Category' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? <span className='text-xs'>{val}</span> : <span className='text-muted-foreground'>—</span>;
      },
      meta: { label: 'Category', icon: Tags },
      enableColumnFilter: false
    },
    {
      id: 'subCategory',
      accessorKey: 'subtype',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Subtype' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? <span className='text-xs'>{val}</span> : <span className='text-muted-foreground'>—</span>;
      },
      meta: {
        label: 'Subtype',
        variant: 'select',
        options: subCategoryOptions,
        icon: Tags
      },
      enableColumnFilter: true
    },
    {
      id: 'subCategoryGroup',
      accessorKey: 'subtypeGroup',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Subtype group' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? <span className='text-xs'>{val}</span> : <span className='text-muted-foreground'>—</span>;
      },
      meta: {
        label: 'Subtype group',
        variant: 'select',
        options: subCategoryGroupOptions,
        icon: Tags
      },
      enableColumnFilter: true
    },
    {
      id: 'companyKey',
      accessorKey: 'companyKey',
      enableSorting: false,
      enableHiding: true,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Company key' />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<string | null>();
        return val ? (
          <div className='flex items-center gap-1'>
            <Key className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='text-xs font-mono'>{val}</span>
          </div>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      meta: { label: 'Company key', icon: Key },
      enableColumnFilter: false
    },
    {
      id: 'locations',
      accessorFn: (row) => row.Location?.length || 0,
      header: ({ column }: { column: Column<Company, unknown> }) => (
        <DataTableColumnHeader column={column} title='Locations' />
      ),
      cell: ({ row }) => {
        const locationCount = row.original.Location?.length || 0;
        return locationCount > 0 ? (
          <Badge variant='outline'>{locationCount} location{locationCount !== 1 ? 's' : ''}</Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
      enableSorting: true,
      enableHiding: true,
      meta: { label: 'Locations', icon: Hash },
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
      meta: { label: 'Created' },
      enableColumnFilter: false
    }
  ];
}

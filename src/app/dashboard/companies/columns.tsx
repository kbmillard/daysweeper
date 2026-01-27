'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Text, Mail, Phone, Globe } from 'lucide-react';
import Link from 'next/link';

type Company = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  segment: string | null;
  tier: string | null;
  createdAt: Date;
  updatedAt: Date;
  Location: Array<{
    addressRaw: string;
    addressComponents: any;
  }>;
};

export const columns: ColumnDef<Company>[] = [
  {
    id: 'name',
    accessorKey: 'name',
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
    id: 'email',
    accessorKey: 'email',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => {
      const company = row.original;
      return company.email ? (
        <div className='flex items-center gap-1 text-sm'>
          <Mail className='h-3 w-3 text-muted-foreground' />
          <span className='text-xs'>{company.email}</span>
        </div>
      ) : (
        <span className='text-muted-foreground'>—</span>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Email',
      placeholder: 'Search by email...',
      variant: 'text',
      icon: Mail
    }
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: ({ column }: { column: Column<Company, unknown> }) => (
      <DataTableColumnHeader column={column} title='Phone' />
    ),
    cell: ({ row }) => {
      const company = row.original;
      return company.phone ? (
        <div className='flex items-center gap-1 text-sm'>
          <Phone className='h-3 w-3 text-muted-foreground' />
          <span className='text-xs'>{company.phone}</span>
        </div>
      ) : (
        <span className='text-muted-foreground'>—</span>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Phone',
      placeholder: 'Search by phone...',
      variant: 'text',
      icon: Phone
    }
  },
  {
    id: 'website',
    accessorKey: 'website',
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
    enableColumnFilter: true,
    meta: {
      label: 'Website',
      placeholder: 'Search by website...',
      variant: 'text',
      icon: Globe
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
    id: 'locations',
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
    enableColumnFilter: true,
    meta: {
      label: 'Locations',
      placeholder: 'Filter by location count...',
      variant: 'text',
      icon: Text
    },
    filterFn: (row, id, value) => {
      const locationCount = row.original.Location?.length || 0;
      const filterValue = value?.toLowerCase() || '';
      if (!filterValue) return true;
      // Allow filtering by number or "has locations" / "no locations"
      if (filterValue === 'has' || filterValue === 'yes') return locationCount > 0;
      if (filterValue === 'no' || filterValue === 'none' || filterValue === '0') return locationCount === 0;
      const num = parseInt(filterValue);
      if (!isNaN(num)) return locationCount === num;
      return String(locationCount).includes(filterValue);
    }
  },
  {
    id: 'createdAt',
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
    },
    enableColumnFilter: true,
    meta: {
      label: 'Created',
      placeholder: 'Filter by date...',
      variant: 'text',
      icon: Text
    }
  }
];

'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { columns } from './columns';

// Type matches the Company type from columns.tsx
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

interface CompaniesTableParams {
  data: Company[];
  totalItems: number;
}

export default function CompaniesTable({
  data,
  totalItems
}: CompaniesTableParams) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  const pageCount = Math.ceil(totalItems / pageSize);

  const { table } = useDataTable({
    data,
    columns: columns as ColumnDef<Company>[],
    pageCount: pageCount,
    shallow: false,
    debounceMs: 500
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

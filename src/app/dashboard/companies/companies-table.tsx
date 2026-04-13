'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableAddColumn } from '@/components/ui/table/data-table-add-column';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { Button } from '@/components/ui/button';
import { useDataTable } from '@/hooks/use-data-table';
import type { Option } from '@/types/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { getColumns } from './columns';

// Type matches the Company type from columns.tsx
type Company = {
  id: string;
  name: string;
  website: string | null;
  status: string | null;
  isSeller: boolean;
  metadata: unknown;
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
  hideAccounts?: boolean;
  stateOptions: Option[];
}

export default function CompaniesTable({
  data,
  totalItems,
  hideAccounts = false,
  stateOptions
}: CompaniesTableParams) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const [, setHideAccounts] = useQueryState('hideAccounts', parseAsString);

  const pageCount = Math.ceil(totalItems / pageSize);

  const columns = useMemo(
    () => getColumns({ stateOptions }) as ColumnDef<Company>[],
    [stateOptions]
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount: pageCount,
    rowCount: totalItems,
    shallow: false,
    debounceMs: 500,
    initialState: {
      columnVisibility: { state: false, actions: true }
    }
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} showViewOptions={false}>
        <Button
          variant={hideAccounts ? 'default' : 'outline'}
          size='sm'
          onClick={() => setHideAccounts(hideAccounts ? null : '1')}
          className='h-8 text-xs'
        >
          {hideAccounts ? 'Accounts hidden — show' : 'Hide accounts'}
        </Button>
        <DataTableAddColumn table={table} />
      </DataTableToolbar>
    </DataTable>
  );
}

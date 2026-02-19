'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableAddColumn } from '@/components/ui/table/data-table-add-column';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { getColumns } from './columns';

// Type matches the Company type from columns.tsx
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

interface CompaniesTableParams {
  data: Company[];
  totalItems: number;
  stateOptions?: { label: string; value: string }[];
  tierOptions?: { label: string; value: string }[];
  categoryOptions?: { label: string; value: string }[];
  subCategoryOptions?: { label: string; value: string }[];
  subCategoryGroupOptions?: { label: string; value: string }[];
}

export default function CompaniesTable({
  data,
  totalItems,
  stateOptions = [],
  tierOptions = [],
  categoryOptions = [],
  subCategoryOptions = [],
  subCategoryGroupOptions = []
}: CompaniesTableParams) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  const pageCount = Math.ceil(totalItems / pageSize);

  const columns = useMemo(
    () =>
      getColumns({
        stateOptions,
        tierOptions,
        categoryOptions,
        subCategoryOptions,
        subCategoryGroupOptions
      }) as ColumnDef<Company>[],
    [stateOptions, tierOptions, categoryOptions, subCategoryOptions, subCategoryGroupOptions]
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount: pageCount,
    shallow: false,
    debounceMs: 500,
    initialState: {
      columnVisibility: { state: false, tier: false, category: false, subCategory: false, subCategoryGroup: false, actions: true }
    }
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} showViewOptions={false}>
        <DataTableAddColumn table={table} />
      </DataTableToolbar>
    </DataTable>
  );
}

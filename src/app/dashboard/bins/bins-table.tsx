'use client';

import { useState, useTransition } from 'react';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

type WarehouseItem = {
  id: string;
  partNumber: string;
  description: string | null;
  bin: string | null;
  quantity: number;
  price: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const columns: ColumnDef<WarehouseItem>[] = [
  {
    accessorKey: 'partNumber',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Part Number" />
    ),
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('partNumber')}</div>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => (
      <div className="max-w-[300px] truncate">
        {row.getValue('description') || '-'}
      </div>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'bin',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bin" />
    ),
    cell: ({ row }) => {
      const bin = row.getValue('bin') as string | null;
      return bin ? (
        <Badge variant="outline" className="font-mono">
          {bin}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quantity" />
    ),
    cell: ({ row }) => {
      const qty = row.getValue('quantity') as number;
      return (
        <div className="text-right font-medium">
          {qty.toLocaleString()}
        </div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ row }) => {
      const price = row.getValue('price') as number | null;
      return (
        <div className="text-right">
          {price ? formatCurrency(price) : '-'}
        </div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('updatedAt') as Date;
      return (
        <div className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString()}
        </div>
      );
    },
    enableSorting: true,
  },
];

export function BinsTable({ initialData }: { initialData: WarehouseItem[] }) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

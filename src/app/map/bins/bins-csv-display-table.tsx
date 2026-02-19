'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Trash2 } from 'lucide-react';

export type CsvBinRow = {
  partNumber: string;
  description: string | null;
  bin: string | null;
  quantity: number;
  changedAt: string | null;
  changedBy: string | null;
};

type EditableCellProps = {
  value: string | number | null;
  rowIndex: number;
  accessorKey: keyof CsvBinRow;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  displayFormat?: (val: string | number | null) => React.ReactNode;
  onSave: (
    rowIndex: number,
    key: keyof CsvBinRow,
    value: string | number | null
  ) => void;
  editing: { rowIndex: number; key: string } | null;
  editValue: string;
  onStartEdit: (
    rowIndex: number,
    key: keyof CsvBinRow,
    current: string
  ) => void;
  onEditValueChange: (v: string) => void;
  onClearEdit: () => void;
};

function EditableCell({
  value,
  rowIndex,
  accessorKey,
  type = 'text',
  align = 'left',
  displayFormat,
  onSave,
  editing,
  editValue,
  onStartEdit,
  onEditValueChange,
  onClearEdit
}: EditableCellProps) {
  const isEditing =
    editing?.rowIndex === rowIndex && editing?.key === accessorKey;

  const handleBlur = () => {
    if (!isEditing) return;
    const normalized =
      type === 'number'
        ? editValue.trim() === ''
          ? null
          : Number(editValue)
        : editValue === ''
          ? null
          : editValue;
    onSave(rowIndex, accessorKey, normalized);
    onClearEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.currentTarget as HTMLElement).blur();
    if (e.key === 'Escape') {
      onClearEdit();
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  const display = displayFormat
    ? displayFormat(value)
    : value === null || value === undefined || value === ''
      ? '-'
      : String(value);

  if (isEditing) {
    return (
      <Input
        autoFocus
        type={type}
        value={editValue}
        onChange={(e) => onEditValueChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`h-8 ${align === 'right' ? 'text-right' : ''}`}
      />
    );
  }

  return (
    <div
      role='button'
      tabIndex={0}
      className={`hover:border-input -mx-2 min-h-8 cursor-text rounded border border-transparent px-2 py-1 ${align === 'right' ? 'text-right' : ''}`}
      onClick={() =>
        onStartEdit(rowIndex, accessorKey, value == null ? '' : String(value))
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStartEdit(
            rowIndex,
            accessorKey,
            value == null ? '' : String(value)
          );
        }
      }}
    >
      {display}
    </div>
  );
}

function csvRowsToCsv(rows: CsvBinRow[]): string {
  const header = 'BIN,PART NUMBER,PART DESCRIPTION';
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = rows.map((r) =>
    [escape(r.bin), escape(r.partNumber), escape(r.description)].join(',')
  );
  return [header, ...lines].join('\n');
}

function filterCsvRowsBySearch(rows: CsvBinRow[], search: string): CsvBinRow[] {
  const q = search.toLowerCase().trim();
  if (!q) return rows;
  return rows.filter((r) => {
    const rowText = [
      r.partNumber,
      r.description,
      r.bin,
      r.changedAt,
      r.changedBy
    ]
      .map((v) => (v == null ? '' : String(v)))
      .join(' ')
      .toLowerCase();
    return rowText.includes(q);
  });
}

export function BinsCsvDisplayTable({
  rows: initialRows,
  onRowsChange
}: {
  rows: CsvBinRow[];
  onRowsChange?: (rows: CsvBinRow[]) => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<{
    rowIndex: number;
    key: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');

  const updateCell = useCallback(
    (rowIndex: number, key: keyof CsvBinRow, value: string | number | null) => {
      setRows((prev) => {
        const next = prev.map((r, i) =>
          i === rowIndex
            ? {
                ...r,
                [key]:
                  key === 'quantity'
                    ? value === null || value === ''
                      ? 0
                      : Number(value)
                    : value === ''
                      ? null
                      : value
              }
            : r
        );
        onRowsChange?.(next);
        return next;
      });
    },
    [onRowsChange]
  );

  const addLine = useCallback(() => {
    const blank: CsvBinRow = {
      partNumber: '',
      description: null,
      bin: null,
      quantity: 0,
      changedAt: null,
      changedBy: null
    };
    setRows((prev) => {
      const next = [...prev, blank];
      onRowsChange?.(next);
      return next;
    });
  }, [onRowsChange]);

  const deleteRow = useCallback(
    (row: CsvBinRow) => {
      setRows((prev) => {
        const i = prev.findIndex(
          (r) =>
            r.partNumber === row.partNumber &&
            r.bin === row.bin &&
            r.description === row.description
        );
        if (i < 0) return prev;
        const next = prev.filter((_, idx) => idx !== i);
        onRowsChange?.(next);
        return next;
      });
    },
    [onRowsChange]
  );

  const startEdit = useCallback(
    (rowIndex: number, key: keyof CsvBinRow, current: string) => {
      setEditing({ rowIndex, key });
      setEditValue(current);
    },
    []
  );

  const columns: ColumnDef<CsvBinRow>[] = [
    {
      accessorKey: 'bin',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Bin' />
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.original.bin}
          rowIndex={row.index}
          accessorKey='bin'
          onSave={updateCell}
          editing={editing}
          editValue={editValue}
          onStartEdit={startEdit}
          onEditValueChange={setEditValue}
          onClearEdit={() => setEditing(null)}
          displayFormat={(v) =>
            v ? <span className='font-mono'>{v}</span> : '-'
          }
        />
      ),
      enableSorting: true,
      enableColumnFilter: true
    },
    {
      accessorKey: 'partNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Part Number' />
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.original.partNumber}
          rowIndex={row.index}
          accessorKey='partNumber'
          onSave={updateCell}
          editing={editing}
          editValue={editValue}
          onStartEdit={startEdit}
          onEditValueChange={setEditValue}
          onClearEdit={() => setEditing(null)}
          displayFormat={(v) => (
            <span className='font-mono font-medium'>{v ?? '-'}</span>
          )}
        />
      ),
      enableSorting: true,
      enableColumnFilter: true
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Part Description' />
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.original.description}
          rowIndex={row.index}
          accessorKey='description'
          onSave={updateCell}
          editing={editing}
          editValue={editValue}
          onStartEdit={startEdit}
          onEditValueChange={setEditValue}
          onClearEdit={() => setEditing(null)}
          displayFormat={(v) => (
            <span className='block max-w-[300px] truncate'>{v ?? '-'}</span>
          )}
        />
      ),
      enableSorting: true,
      enableColumnFilter: true,
      enableHiding: false,
      meta: { label: 'Part Description' },
      size: 280,
      minSize: 180
    },
    {
      accessorKey: 'changedAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Date Changed' />
      ),
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm'>
          {row.original.changedAt ?? '-'}
        </span>
      ),
      enableSorting: true
    },
    {
      accessorKey: 'changedBy',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='User' />
      ),
      cell: ({ row }) => (
        <span className='text-sm'>{row.original.changedBy ?? '-'}</span>
      ),
      enableSorting: true,
      enableColumnFilter: true
    },
    {
      id: 'actions',
      header: () => <span className='sr-only'>Actions</span>,
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='icon'
          className='text-destructive hover:text-destructive h-8 w-8'
          onClick={() => deleteRow(row.original)}
          aria-label='Delete row'
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      ),
      enableSorting: false
    }
  ];

  const filteredRows = useMemo(
    () => filterCsvRowsBySearch(rows, globalFilter),
    [rows, globalFilter]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } }
  });

  return (
    <DataTable table={table}>
      <div className='flex flex-1 items-center gap-2'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search all columns...'
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className='h-8 pl-8'
          />
        </div>
        <Button variant='outline' size='sm' onClick={addLine}>
          <Plus className='mr-1 h-4 w-4' />
          Add line
        </Button>
      </div>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

export { csvRowsToCsv };

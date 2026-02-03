'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
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
import { Search, Plus, Trash2, Trash, Save } from 'lucide-react';
import { toast } from 'sonner';

export type WarehouseItem = {
  id: string;
  partNumber: string;
  description: string | null;
  bin: string | null;
  quantity: number;
  changedAt: Date | null;
  changedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  price?: number | null;
  meta?: unknown;
};

type EditableCellProps = {
  value: string | number | null;
  rowId: string;
  accessorKey: string;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  displayFormat?: (val: string | number | null) => React.ReactNode;
  onSave: (
    rowId: string,
    key: string,
    value: string | number | null
  ) => Promise<void>;
  editing: { rowId: string; key: string } | null;
  editValue: string;
  onStartEdit: (rowId: string, key: string, current: string) => void;
  onEditValueChange: (v: string) => void;
  onClearEdit: () => void;
};

function EditableCell({
  value,
  rowId,
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
  const isEditing = editing?.rowId === rowId && editing?.key === accessorKey;

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
    onSave(rowId, accessorKey, normalized).finally(onClearEdit);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLElement).blur();
    }
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
        onStartEdit(rowId, accessorKey, value == null ? '' : String(value))
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStartEdit(rowId, accessorKey, value == null ? '' : String(value));
        }
      }}
    >
      {display}
    </div>
  );
}

function filterBinsBySearch(
  rows: WarehouseItem[],
  search: string
): WarehouseItem[] {
  const q = search.toLowerCase().trim();
  if (!q) return rows;
  return rows.filter((row) => {
    const fields: (keyof WarehouseItem)[] = [
      'partNumber',
      'description',
      'bin',
      'changedAt',
      'changedBy'
    ];
    const rowText = fields
      .map((k) => {
        const v = row[k];
        if (v instanceof Date) return v.toISOString();
        return v == null ? '' : String(v);
      })
      .join(' ')
      .toLowerCase();
    return rowText.includes(q);
  });
}

type BinsTableProps = { initialData: WarehouseItem[] };

export function BinsTable({ initialData }: BinsTableProps) {
  const router = useRouter();
  const { user } = useUser();
  const [data, setData] = useState(initialData);
  const [clearing, setClearing] = useState(false);
  const [editing, setEditing] = useState<{ rowId: string; key: string } | null>(
    null
  );
  const [editValue, setEditValue] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const displayName =
    user?.fullName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.id ||
    '';

  const updateCell = useCallback(
    async (rowId: string, key: string, value: string | number | null) => {
      try {
        const payload: Record<string, unknown> = {};
        payload[key] =
          key === 'quantity' && (value === null || value === '') ? 0 : value;
        if (displayName) payload.changedByDisplayName = displayName;

        const res = await fetch(`/api/bins/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Update failed');
        }
        const updated = await res.json();
        setData((prev) =>
          prev.map((row) => (row.id === rowId ? { ...row, ...updated } : row))
        );
        toast.success('Updated');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
        throw e;
      }
    },
    [displayName]
  );

  const startEdit = useCallback(
    (rowId: string, key: string, current: string) => {
      setEditing({ rowId, key });
      setEditValue(current);
    },
    []
  );

  const refetchBins = useCallback(async () => {
    try {
      const res = await fetch('/api/bins');
      if (!res.ok) throw new Error('Failed to load bins');
      const list = await res.json();
      setData(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh');
    }
  }, []);

  const addLine = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: `NEW-${Date.now()}`,
          bin: '',
          description: null,
          changedByDisplayName: displayName || undefined
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Create failed');
      }
      toast.success('Line added');
      await refetchBins();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add line');
    } finally {
      setAdding(false);
    }
  }, [adding, displayName, refetchBins]);

  const deleteRow = useCallback(
    async (rowId: string) => {
      try {
        const res = await fetch(`/api/bins/${rowId}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Delete failed');
        }
        toast.success('Row deleted');
        await refetchBins();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to delete');
      }
    },
    [refetchBins]
  );

  const saveCurrentEdit = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const isNumber = editing.key === 'quantity';
      const normalized = isNumber
        ? editValue.trim() === ''
          ? null
          : Number(editValue)
        : editValue === ''
          ? null
          : editValue;
      await updateCell(editing.rowId, editing.key, normalized);
      setEditing(null);
      setEditValue('');
    } finally {
      setSaving(false);
    }
  }, [editing, editValue, updateCell]);

  const clearAllBins = useCallback(async () => {
    if (!confirm('Clear all bins? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/bins', { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Clear failed');
      }
      const json = await res.json();
      toast.success(`Cleared ${json.deleted ?? 0} rows`);
      await refetchBins();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear bins');
    } finally {
      setClearing(false);
    }
  }, [router, refetchBins]);

  const columns: ColumnDef<WarehouseItem>[] = [
    {
      accessorKey: 'bin',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Bin' />
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.original.bin}
          rowId={row.original.id}
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
          rowId={row.original.id}
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
          rowId={row.original.id}
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
        <div className='text-muted-foreground text-sm'>
          {row.original.changedAt
            ? new Date(row.original.changedAt).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short'
              })
            : '-'}
        </div>
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
          onClick={() => deleteRow(row.original.id)}
          aria-label='Delete row'
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      ),
      enableSorting: false
    }
  ];

  const filteredData = useMemo(
    () => filterBinsBySearch(data, globalFilter),
    [data, globalFilter]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } }
  });

  return (
    <DataTable table={table}>
      <div className='flex flex-1 items-center gap-2'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search...'
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className='h-8 pl-8'
          />
        </div>
        <span className='text-muted-foreground text-sm whitespace-nowrap'>
          {data.length} row{data.length !== 1 ? 's' : ''}
        </span>
        <Button variant='outline' size='sm' onClick={addLine} disabled={adding}>
          <Plus className='mr-1 h-4 w-4' />
          Add line
        </Button>
        <Button
          variant='default'
          size='sm'
          onClick={saveCurrentEdit}
          disabled={!editing || saving}
          title={editing ? 'Save current edit' : 'Edit a cell first to save'}
        >
          <Save className='mr-1 h-4 w-4' />
          Save
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={clearAllBins}
          disabled={clearing || data.length === 0}
          className='text-destructive hover:text-destructive'
        >
          <Trash className='mr-1 h-4 w-4' />
          Clear all
        </Button>
      </div>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

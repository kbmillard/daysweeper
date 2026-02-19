'use client';

import type { Table } from '@tanstack/react-table';
import { Plus, Columns } from 'lucide-react';
import * as React from 'react';
import { CheckIcon } from '@radix-ui/react-icons';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DataTableAddColumnProps<TData> {
  table: Table<TData>;
  /** Label for the trigger button. Default: "Add column" */
  label?: string;
  /** Include columns without accessorFn (e.g. filter-only columns). Default: true */
  includeFilterColumns?: boolean;
}

/**
 * "Add column" dropdown: toggles column visibility. Lists all columns that can be hidden.
 */
export function DataTableAddColumn<TData>({
  table,
  label = 'Add column',
  includeFilterColumns = true
}: DataTableAddColumnProps<TData>) {
  const columns = React.useMemo(() => {
    const all = table.getAllColumns().filter((col) => col.getCanHide());
    if (includeFilterColumns) return all;
    return all.filter((col) => typeof col.accessorFn !== 'undefined');
  }, [table, includeFilterColumns]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
          <Columns className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup heading="Toggle columns">
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <span className="truncate">
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                  <CheckIcon
                    className={cn(
                      'ml-auto size-4 shrink-0',
                      column.getIsVisible() ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

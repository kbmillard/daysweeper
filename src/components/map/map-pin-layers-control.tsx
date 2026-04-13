'use client';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { IconLayersSubtract } from '@tabler/icons-react';

export type MapPinLayers = {
  containers: boolean;
  companies: boolean;
  sellers: boolean;
};

type Props = {
  value: MapPinLayers;
  onChange: (next: MapPinLayers) => void;
  /** Dark style for main map chrome */
  variant?: 'light' | 'dark';
};

export function MapPinLayersControl({ value, onChange, variant = 'light' }: Props) {
  const dark = variant === 'dark';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          title='Show or hide pin layers'
          className={
            dark
              ? 'ios-glass flex h-10 items-center gap-2 rounded-2xl px-3 text-[14px] font-medium text-white shadow-sm'
              : 'inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm'
          }
        >
          <IconLayersSubtract className={`h-[18px] w-[18px] shrink-0 ${dark ? 'text-sky-300' : 'text-sky-600'}`} />
          <span className='hidden sm:inline'>Layers</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-56'>
        <DropdownMenuLabel>Map pins</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={value.containers}
          onCheckedChange={(c) => onChange({ ...value, containers: Boolean(c) })}
          onSelect={(e) => e.preventDefault()}
        >
          <span className='flex items-center gap-2'>
            <span className='inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-600' />
            Containers
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value.companies}
          onCheckedChange={(c) => onChange({ ...value, companies: Boolean(c) })}
          onSelect={(e) => e.preventDefault()}
        >
          <span className='flex items-center gap-2'>
            <span className='inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-purple-600' />
            Companies
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value.sellers}
          onCheckedChange={(c) => onChange({ ...value, sellers: Boolean(c) })}
          onSelect={(e) => e.preventDefault()}
        >
          <span className='flex items-center gap-2'>
            <span className='inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gray-500' />
            Buyers
          </span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
import { cn } from '@/lib/utils';

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
  /** When true, Containers / Companies / Sellers stay on and cannot be toggled. */
  layersFrozen?: boolean;
};

export function MapPinLayersControl({
  value,
  onChange,
  variant = 'light',
  layersFrozen = false
}: Props) {
  const dark = variant === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          title='Map pin layers'
          className={
            dark
              ? 'ios-glass flex h-10 items-center gap-2 rounded-2xl px-3 text-[14px] font-semibold !text-neutral-950 shadow-sm'
              : 'inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm'
          }
        >
          <IconLayersSubtract
            className={`h-[18px] w-[18px] shrink-0 ${dark ? '!text-neutral-900' : 'text-sky-600'}`}
          />
          <span className='hidden sm:inline'>Layers</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        side='left'
        sideOffset={8}
        alignOffset={0}
        collisionPadding={16}
        className={cn(
          /** Above map chrome (z-40) + pin drawer (z-60); avoids painting under overlapping panels */
          'z-[200] w-64 shadow-xl',
          dark ? 'border border-white/15 bg-[#1e1e32] text-zinc-100' : ''
        )}
      >
        <DropdownMenuLabel className={dark ? 'text-zinc-100' : ''}>Map pins</DropdownMenuLabel>
        <DropdownMenuSeparator className={dark ? '!bg-white/15' : ''} />
        <DropdownMenuLabel
          className={cn(
            'text-[11px] font-normal text-muted-foreground',
            dark && 'text-white/55'
          )}
        >
          {layersFrozen ? 'Pin layers (all on)' : 'Toggle layers'}
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={value.containers}
          disabled={layersFrozen}
          onCheckedChange={(c) => onChange({ ...value, containers: Boolean(c) })}
          onSelect={(e) => e.preventDefault()}
          className={dark ? 'focus:bg-white/10 focus:text-white' : ''}
        >
          Containers
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value.companies}
          disabled={layersFrozen}
          onCheckedChange={(c) => onChange({ ...value, companies: Boolean(c) })}
          onSelect={(e) => e.preventDefault()}
          className={dark ? 'focus:bg-white/10 focus:text-white' : ''}
        >
          Companies
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value.sellers}
          disabled={layersFrozen}
          onCheckedChange={(c) => onChange({ ...value, sellers: Boolean(c) })}
          onSelect={(e) => e.preventDefault()}
          className={dark ? 'focus:bg-white/10 focus:text-white' : ''}
        >
          Sellers
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

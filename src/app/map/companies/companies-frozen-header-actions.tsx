import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IconPlus, IconUpload } from '@tabler/icons-react';

/** Non-interactive copies of Import / Add so the bar still reads the same when the list is frozen. */
export function CompaniesFrozenHeaderActions() {
  return (
    <div
      className='flex flex-wrap items-center gap-2 pointer-events-none select-none opacity-50'
      aria-hidden
    >
      <span className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex text-xs md:text-sm')}>
        <IconUpload className='mr-2 h-4 w-4' />
        Import JSON
      </span>
      <span className={cn(buttonVariants(), 'inline-flex text-xs md:text-sm')}>
        <IconPlus className='mr-2 h-4 w-4' /> Add New
      </span>
    </div>
  );
}

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive overflow-hidden before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-[hsl(210,100%,58%)] to-[hsl(210,100%,45%)] text-white shadow-[0_6px_24px_hsla(210,100%,50%,0.5),0_2px_6px_hsla(210,100%,50%,0.3),inset_0_2px_2px_rgba(255,255,255,0.5),inset_0_-2px_2px_rgba(0,0,0,0.15)] hover:from-[hsl(210,100%,62%)] hover:to-[hsl(210,100%,48%)] hover:shadow-[0_10px_40px_hsla(210,100%,50%,0.55),0_4px_12px_hsla(210,100%,50%,0.4),inset_0_2px_2px_rgba(255,255,255,0.6)] hover:-translate-y-1 active:translate-y-0.5 active:from-[hsl(210,100%,42%)] active:to-[hsl(210,100%,35%)] active:shadow-[0_1px_4px_hsla(210,100%,50%,0.2),inset_0_3px_6px_rgba(0,0,0,0.25),inset_0_-1px_1px_rgba(255,255,255,0.2)]',
        destructive:
          'bg-gradient-to-b from-[hsl(4,85%,60%)] to-[hsl(4,85%,48%)] text-white shadow-[0_6px_24px_hsla(4,85%,50%,0.5),0_2px_6px_hsla(4,85%,50%,0.3),inset_0_2px_2px_rgba(255,255,255,0.45),inset_0_-2px_2px_rgba(0,0,0,0.18)] hover:from-[hsl(4,85%,65%)] hover:to-[hsl(4,85%,52%)] hover:shadow-[0_10px_40px_hsla(4,85%,50%,0.5),0_4px_12px_hsla(4,85%,50%,0.35)] hover:-translate-y-1 active:translate-y-0.5 active:from-[hsl(4,85%,45%)] active:to-[hsl(4,85%,38%)] active:shadow-[0_1px_4px_hsla(4,85%,50%,0.2),inset_0_3px_6px_rgba(0,0,0,0.25)]',
        outline:
          'bg-white/15 dark:bg-white/10 backdrop-blur-xl border border-white/30 dark:border-white/20 text-foreground shadow-[0_6px_20px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06),inset_0_2px_2px_rgba(255,255,255,0.5)] hover:bg-[hsla(210,100%,50%,0.15)] hover:border-[hsla(210,100%,50%,0.4)] hover:shadow-[0_10px_32px_hsla(210,100%,50%,0.18),0_4px_10px_rgba(0,0,0,0.08),inset_0_2px_2px_rgba(255,255,255,0.6)] hover:-translate-y-1 active:translate-y-0.5 active:bg-[hsla(210,100%,50%,0.2)] active:shadow-[0_1px_4px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(0,0,0,0.1)] before:from-white/25',
        secondary:
          'bg-gradient-to-b from-secondary to-secondary/85 text-secondary-foreground shadow-[0_6px_20px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04),inset_0_2px_2px_rgba(255,255,255,0.7),inset_0_-1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_32px_rgba(0,0,0,0.12),0_4px_10px_rgba(0,0,0,0.06),inset_0_2px_2px_rgba(255,255,255,0.8)] hover:-translate-y-1 active:translate-y-0.5 active:shadow-[0_1px_4px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(0,0,0,0.1)]',
        ghost:
          'hover:bg-black/[0.06] dark:hover:bg-white/[0.1] hover:-translate-y-0.5 active:translate-y-0.5 active:bg-black/[0.1] dark:active:bg-white/[0.12] before:hidden',
        link: 'text-[hsl(210,100%,50%)] dark:text-[hsl(210,100%,70%)] font-medium hover:opacity-70 active:opacity-50 before:hidden'
      },
      size: {
        default: 'h-11 px-6 py-2.5 has-[>svg]:px-5',
        sm: 'h-9 rounded-xl gap-1.5 px-4 has-[>svg]:px-3 text-[13px]',
        lg: 'h-12 rounded-2xl px-8 has-[>svg]:px-6',
        icon: 'size-11 rounded-2xl'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

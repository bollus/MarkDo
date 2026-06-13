import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-hover',
        ghost: 'bg-transparent text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
      },
      size: {
        sm: 'h-8 px-2.5',
        icon: 'h-8 w-8',
        lgIcon: 'h-11 w-12'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);

Button.displayName = 'Button';

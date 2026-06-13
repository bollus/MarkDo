import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-control border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-900 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500',
        className
      )}
      {...props}
    />
  )
);

Input.displayName = 'Input';

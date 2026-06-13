import * as React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-card border border-slate-200/70 bg-white/80 dark:border-neutral-700 dark:bg-neutral-850', className)} {...props} />
  )
);

Card.displayName = 'Card';

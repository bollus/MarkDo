import * as React from 'react';
import { cn } from '../../lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-control border border-slate-300/80 bg-white/95 px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500',
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';

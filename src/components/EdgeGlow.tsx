import { cn } from '../lib/utils';

type EdgeGlowProps = {
  edge: DockEdge;
  active: boolean;
};

export function EdgeGlow({ edge, active }: EdgeGlowProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute opacity-0 transition-opacity duration-200',
        active && 'animate-edge-glow opacity-100',
        edge === 'right' &&
          'right-0 top-0 h-full w-2 rounded-r-panel bg-gradient-to-r from-primary/0 to-primary/85 shadow-[-12px_0_22px_rgba(37,99,235,.28)]',
        edge === 'left' &&
          'left-0 top-0 h-full w-2 rounded-l-panel bg-gradient-to-r from-primary/85 to-primary/0 shadow-[12px_0_22px_rgba(37,99,235,.28)]',
        edge === 'top' &&
          'left-0 top-0 h-2 w-full rounded-t-panel bg-gradient-to-b from-primary/85 to-primary/0 shadow-[0_12px_22px_rgba(37,99,235,.28)]',
        edge === 'bottom' &&
          'bottom-0 left-0 h-2 w-full rounded-b-panel bg-gradient-to-b from-primary/0 to-primary/85 shadow-[0_-12px_22px_rgba(37,99,235,.28)]'
      )}
    />
  );
}

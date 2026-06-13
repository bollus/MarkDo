import { CalendarClock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DeadlinePicker } from './components/DeadlinePicker';
import { Input } from './components/ui/input';
import { formatDeadline } from './lib/date';
import { createTodo, loadSettings } from './lib/storage';
import { cn } from './lib/utils';

export function QuickAddApp() {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function applyTheme() {
    const settings = loadSettings();
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && systemDark));
  }

  useEffect(() => {
    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    window.markdo.onQuickAddOpen(() => {
      applyTheme();
      setTitle('');
      setDeadline(null);
      setDeadlineOpen(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => media.removeEventListener('change', applyTheme);
  }, []);

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    window.markdo.createQuickTodo(createTodo(nextTitle, deadline));
    setTitle('');
    setDeadline(null);
    setDeadlineOpen(false);
  }

  return (
    <main
      className="h-screen w-screen bg-transparent p-2 text-slate-950 dark:text-neutral-100"
      onKeyDown={(event) => {
        if (event.key === 'Escape') window.markdo.hideCurrent();
      }}
    >
      <section className="markdo-25d-outer w-full overflow-visible rounded-[18px] p-[3px]">
        <div className="markdo-25d-inner relative rounded-[15px] p-2">
          <form className="grid h-12 grid-cols-[1fr_42px] items-center gap-2" onSubmit={submit}>
            <Input
              ref={inputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="输入待办..."
              autoComplete="off"
              className="h-10"
            />
            <button
              type="button"
              className={cn(
                'grid h-10 w-[42px] place-items-center rounded-control border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-white',
                deadlineOpen && 'border-primary/60 ring-2 ring-primary/10'
              )}
              title={formatDeadline(deadline)}
              onClick={() => setDeadlineOpen((value) => !value)}
            >
              <CalendarClock className="h-4.5 w-4.5" />
            </button>
            {deadlineOpen && (
              <DeadlinePicker
                value={deadline}
                className="absolute right-2 top-[58px] z-20"
                onCancel={() => setDeadlineOpen(false)}
                onConfirm={(value) => {
                  setDeadline(value);
                  setDeadlineOpen(false);
                }}
              />
            )}
          </form>
        </div>
      </section>
    </main>
  );
}

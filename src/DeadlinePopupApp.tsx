import { useEffect, useState } from 'react';
import { DeadlinePicker } from './components/DeadlinePicker';
import { loadSettings } from './lib/storage';

type DeadlinePayload = {
  id: string;
  deadline: string | null;
};

export function DeadlinePopupApp() {
  const [payload, setPayload] = useState<DeadlinePayload | null>(null);

  function applyTheme() {
    const settings = loadSettings();
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && systemDark));
  }

  useEffect(() => {
    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyTheme);
    window.markdo.onDeadlineInit((value) => {
      applyTheme();
      setPayload(value);
    });
    return () => media.removeEventListener('change', applyTheme);
  }, []);

  return (
    <main
      className="h-screen w-screen bg-transparent text-slate-950 dark:text-neutral-100"
      onKeyDown={(event) => {
        if (event.key === 'Escape') window.markdo.hideCurrent();
      }}
    >
      {payload && (
        <DeadlinePicker
          value={payload.deadline}
          className="h-full w-full shadow-none"
          onCancel={() => window.markdo.hideCurrent()}
          onConfirm={(deadline) => window.markdo.saveDeadline({ id: payload.id, deadline })}
        />
      )}
    </main>
  );
}

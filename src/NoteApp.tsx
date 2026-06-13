import { Clock, FileText, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { loadSettings } from './lib/storage';

function updatedLabel(value?: string) {
  if (!value) return '尚未保存';
  const date = new Date(value);
  return `最后更新：${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

export function NoteApp() {
  const [todo, setTodo] = useState<TodoItem | null>(null);
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [titleHover, setTitleHover] = useState(false);

  useEffect(() => {
    const settings = loadSettings();
    const applyTheme = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && systemDark));
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, []);

  useEffect(() => {
    window.markdo.onNoteInit((item) => {
      setTodo(item);
      setSummary(item.summary || '');
      setDetails(item.details || '');
      window.setTimeout(() => document.getElementById('noteSummary')?.focus(), 0);
    });
  }, []);

  function saveAndClose() {
    if (!todo) return;
    window.markdo.saveNote({ id: todo.id, summary: summary.trim(), details: details.trim() });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') window.markdo.closeCurrent();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveAndClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <main className="markdo-25d-outer h-screen w-screen overflow-hidden rounded-panel p-[3px] text-slate-900 dark:text-neutral-100">
      <div className="markdo-25d-inner grid h-full w-full grid-rows-[56px_minmax(0,1fr)_56px] overflow-hidden rounded-[11px]">
      <header className="flex items-center justify-between border-b border-slate-200/70 px-4 [-webkit-app-region:drag] dark:border-neutral-800">
        <div className="relative flex min-w-0 items-center gap-2.5">
          <FileText className="h-5 w-5 text-slate-600 dark:text-neutral-300" />
          <h1
            className="max-w-[250px] truncate text-[18px] font-bold"
            onMouseEnter={() => setTitleHover(true)}
            onMouseLeave={() => setTitleHover(false)}
          >
            {todo?.title || '待办'}
          </h1>
          {titleHover && todo?.title && (
            <div className="pointer-events-none absolute left-7 top-9 z-50 max-w-[300px] rounded-card border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-lg dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-100">
              {todo.title}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <Button variant="ghost" size="icon" aria-label="最小化" onClick={() => window.markdo.minimizeCurrent()}>
            <Minus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="关闭" onClick={() => window.markdo.closeCurrent()}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <section className="flex min-h-0 flex-col gap-3 px-4 py-3">
        <label className="flex flex-col gap-1 text-[13px] text-slate-600 dark:text-neutral-300">
          备注
          <Textarea
            id="noteSummary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="补充这条待办最关键的上下文。"
            className="min-h-[66px]"
          />
        </label>
        <label className="flex min-h-0 flex-1 flex-col text-[13px] text-slate-600 dark:text-neutral-300">
          <span className="mb-1 leading-none">详细说明（可编辑）</span>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-slate-300/80 bg-white/95 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10 dark:border-neutral-700 dark:bg-neutral-800">
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="链接、注意事项、检查项、沟通记录都放这里。"
              className="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
            {todo?.screenshotDataUrl && (
              <button
                type="button"
                className="mx-2 mb-2 overflow-hidden rounded-control border border-slate-200 bg-slate-50 text-left dark:border-neutral-700 dark:bg-neutral-850"
                onClick={() => window.markdo.openImage(todo.screenshotDataUrl!)}
              >
                <img src={todo.screenshotDataUrl} alt="OCR 截图原图" className="h-20 w-full object-contain" />
                <span className="block border-t border-slate-200 px-2 py-1 text-xs text-slate-500 dark:border-neutral-700 dark:text-neutral-300">
                  点击查看 OCR 截图原图
                </span>
              </button>
            )}
          </div>
        </label>
      </section>

      <footer className="flex items-center justify-between gap-3 px-4 pb-4">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
          <Clock className="h-4 w-4 shrink-0" />
          {updatedLabel(todo?.updatedAt)}
        </span>
        <Button onClick={saveAndClose} className="h-9 min-w-[74px]">
          完成
        </Button>
      </footer>
      </div>
    </main>
  );
}

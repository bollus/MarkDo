import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CheckCircle2, ChevronsLeft, Clipboard, List, Moon, Plus, RotateCcw, Settings as SettingsIcon, Sun, SunMoon } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { EdgeGlow } from './components/EdgeGlow';
import { TodoItem } from './components/TodoItem';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import markdoLogo from './assets/markdo.png';
import { cn } from './lib/utils';
import {
  createTodo,
  loadDeletedTodos,
  loadSettings,
  loadTodos,
  saveDeletedTodos,
  saveSettings,
  saveTodos,
  type DeletedTodo,
  type Settings
} from './lib/storage';

type FilterMode = 'all' | 'open' | 'done' | 'deleted';

function ocrFeedbackClass(status: string) {
  if (!status) return '';
  if (status.includes('框选') || status.includes('截图') || status.includes('识别')) return 'ocr-feedback-busy';
  if (status.includes('生成')) return 'ocr-feedback-success';
  if (status.includes('未识别')) return 'ocr-feedback-empty';
  if (status.includes('失败')) return 'ocr-feedback-error';
  if (status.includes('取消')) return 'ocr-feedback-cancel';
  return '';
}

function displayShortcut(shortcut: string) {
  const isMac = window.markdo.platform === 'darwin';
  const labels: Record<string, string> = {
    CommandOrControl: isMac ? '⌘' : 'Ctrl',
    Command: '⌘',
    Cmd: '⌘',
    Control: isMac ? '⌃' : 'Ctrl',
    Ctrl: isMac ? '⌃' : 'Ctrl',
    Shift: isMac ? '⇧' : 'Shift',
    Alt: isMac ? '⌥' : 'Alt',
    Option: '⌥',
    Space: 'Space'
  };
  return shortcut
    .split('+')
    .map((part) => labels[part] || part)
    .join(isMac ? ' ' : '+');
}

export function App() {
  const [todos, setTodos] = useState<TodoItem[]>(() => loadTodos());
  const [deletedTodos, setDeletedTodos] = useState<DeletedTodo[]>(() => loadDeletedTodos());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [filter, setFilter] = useState<FilterMode>('all');
  const [compact, setCompact] = useState(false);
  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [edge, setEdge] = useState<DockEdge>('right');
  const [edgePreview, setEdgePreview] = useState(false);
  const [draggingWindow, setDraggingWindow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [closePopupsToken, setClosePopupsToken] = useState(0);
  const [recordingShortcut, setRecordingShortcut] = useState<'ocr' | 'quickAdd' | null>(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [cssTransition, setCssTransition] =
    useState<'panel-collapse' | 'strip-enter' | 'strip-collapse' | 'panel-enter' | 'blank' | null>(null);
  const [, forceMinute] = useState(0);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => saveTodos(todos), [todos]);
  useEffect(() => saveDeletedTodos(deletedTodos), [deletedTodos]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    window.markdo.setOcrShortcut(settings.ocrShortcut);
  }, [settings.ocrShortcut]);
  useEffect(() => {
    window.markdo.setQuickAddShortcut(settings.quickAddShortcut);
  }, [settings.quickAddShortcut]);
  useEffect(() => {
    const applyTheme = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && systemDark));
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  useEffect(() => {
    const timer = window.setInterval(() => forceMinute((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    function closeSettings(event: PointerEvent) {
      const target = event.target as Node;
      if (settingsMenuRef.current?.contains(target) || settingsButtonRef.current?.contains(target)) return;
      setSettingsOpen(false);
    }
    document.addEventListener('pointerdown', closeSettings);
    return () => document.removeEventListener('pointerdown', closeSettings);
  }, [settingsOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    function closeFilter(event: PointerEvent) {
      const target = event.target as Node;
      if (filterMenuRef.current?.contains(target) || filterButtonRef.current?.contains(target)) return;
      setFilterOpen(false);
    }
    document.addEventListener('pointerdown', closeFilter);
    return () => document.removeEventListener('pointerdown', closeFilter);
  }, [filterOpen]);

  useEffect(() => {
    window.markdo.onCollapsed((state) => {
      setCollapsed(state.collapsed);
      setEdge(state.edge || 'right');
      setEdgePreview(Boolean(state.dragging && state.docked));
    });
  }, []);

  useEffect(() => {
    window.markdo.onCollapseVisual((state) => {
      setEdge(state.edge);
      setCssTransition(state.mode);
      window.setTimeout(() => setCssTransition(null), 185);
    });
  }, []);

  useEffect(() => {
    window.markdo.onClosePopups(() => {
      setSettingsOpen(false);
      setFilterOpen(false);
      setClosePopupsToken((value) => value + 1);
    });
    window.markdo.onOpenSettings(() => {
      setSettingsOpen(true);
      setFilterOpen(false);
    });
    window.markdo.onOcrTodo((todo) => {
      runListTransition(() => {
        setTodos((current) => [todo, ...current]);
        setFilter('all');
      });
    });
    window.markdo.onQuickAddTodo((todo) => {
      runListTransition(() => {
        setTodos((current) => [todo, ...current]);
        setFilter('all');
      });
    });
    window.markdo.onNoteUpdated((payload) => {
      setTodos((current) =>
        current.map((todo) =>
          todo.id === payload.id
            ? { ...todo, ...payload, updatedAt: new Date().toISOString() }
            : todo
        )
      );
    });
    window.markdo.onDeadlineUpdated((payload) => {
      setTodos((current) =>
        current.map((todo) =>
          todo.id === payload.id
            ? { ...todo, deadline: payload.deadline, updatedAt: new Date().toISOString() }
            : todo
        )
      );
    });
    window.markdo.onOcrStatus(setOcrStatus);
    window.markdo.onShortcutStatus(setOcrStatus);
    window.markdo.onQuickAdd(() => {
      setFilter('all');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
  }, []);

  useEffect(() => {
    if (!ocrStatus) return;
    const shouldKeep = ocrStatus.includes('框选') || ocrStatus.includes('截图') || ocrStatus.includes('识别');
    const isShortcutFailure = ocrStatus.includes('快捷键注册失败');
    const timer = window.setTimeout(() => {
      setOcrStatus(shouldKeep ? 'OCR 失败' : '');
    }, shouldKeep ? 20000 : isShortcutFailure ? 6500 : 3600);
    return () => window.clearTimeout(timer);
  }, [ocrStatus]);

  const visibleTodos = useMemo(() => {
    const filtered =
      filter === 'open' ? todos.filter((todo) => !todo.done) : filter === 'done' ? todos.filter((todo) => todo.done) : todos;
    return [...filtered].sort((a, b) => Number(a.done) - Number(b.done));
  }, [filter, todos]);

  const openCount = todos.filter((todo) => !todo.done).length;
  const deletedCount = deletedTodos.length;
  const ocrFeedback = ocrFeedbackClass(ocrStatus);
  const showStrip =
    (collapsed && cssTransition === null) || cssTransition === 'strip-enter' || cssTransition === 'strip-collapse';
  const showPanel =
    (!collapsed && cssTransition === null) || cssTransition === 'panel-collapse' || cssTransition === 'panel-enter';

  function addTodo(event: React.FormEvent) {
    event.preventDefault();
    const title = input.trim();
    if (!title) return;
    setTodos((current) => [createTodo(title), ...current]);
    setInput('');
  }

  function updateTodo(id: string, patch: Partial<TodoItem>) {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, ...patch, updatedAt: new Date().toISOString() } : todo))
    );
  }

  function runListTransition(update: () => void) {
    const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => void };
    if (!transitionDocument.startViewTransition) {
      update();
      return;
    }
    try {
      transitionDocument.startViewTransition(() => flushSync(update));
    } catch {
      update();
    }
  }

  function toggleTodo(id: string) {
    const done = !todos.find((item) => item.id === id)?.done;
    runListTransition(() => updateTodo(id, { done }));
  }

  function softDeleteTodo(id: string) {
    const todo = todos.find((item) => item.id === id);
    if (!todo) return;
    setTodos((current) => current.filter((item) => item.id !== id));
    setDeletedTodos((current) => [{ ...todo, deletedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== id)]);
  }

  function restoreTodo(id: string) {
    const deleted = deletedTodos.find((item) => item.id === id);
    if (!deleted) return;
    const { deletedAt: _deletedAt, ...todo } = deleted;
    runListTransition(() => {
      setDeletedTodos((current) => current.filter((item) => item.id !== id));
      setTodos((current) => [{ ...todo, updatedAt: new Date().toISOString() }, ...current]);
    });
  }

  function handleTodoDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    setTodos((current) => {
      const activeIndex = current.findIndex((item) => item.id === activeId);
      const targetIndex = current.findIndex((item) => item.id === overId);
      if (activeIndex < 0 || targetIndex < 0 || activeIndex === targetIndex) return current;

      const active = current[activeIndex];
      const target = current[targetIndex];
      if (active.done !== target.done) return current;

      return arrayMove(current, activeIndex, targetIndex);
    });
  }

  function selectFilter(nextFilter: FilterMode) {
    setFilter(nextFilter);
    setFilterOpen(false);
  }

  function formatShortcut(event: React.KeyboardEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!recordingShortcut) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return;
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    parts.push(key === ' ' ? 'Space' : key);
    const shortcut = parts.join('+');
    setSettings((current) =>
      recordingShortcut === 'ocr' ? { ...current, ocrShortcut: shortcut } : { ...current, quickAddShortcut: shortcut }
    );
    setRecordingShortcut(null);
  }

  function requestExpand() {
    window.markdo.expand();
  }

  function requestCollapse() {
    window.markdo.collapseIfDocked();
  }

  async function beginWindowDrag() {
    setDraggingWindow(true);
    await window.markdo.dragStart();
  }

  async function endWindowDrag() {
    setDraggingWindow(false);
    await window.markdo.dragEnd();
  }

  const dockClass = `dock-${edge}`;

  return (
    <main
      className={cn('h-screen w-screen select-none bg-transparent', dockClass, collapsed && 'is-collapsed')}
      onMouseLeave={() => {
        if (!collapsed && !draggingWindow) window.setTimeout(requestCollapse, 220);
      }}
      onMouseEnter={() => setDraggingWindow(false)}
      onPointerUp={endWindowDrag}
    >
      <section
        className={cn(
          'markdo-25d-outer hidden h-full w-full overflow-hidden p-[3px] text-slate-600 dark:text-neutral-300',
          ocrFeedback,
          showStrip && 'flex',
          cssTransition === 'strip-enter' && 'animate-css-strip-enter',
          cssTransition === 'strip-collapse' && 'animate-css-strip-collapse',
          (edge === 'left' || edge === 'right') && 'flex-col rounded-[26px]',
          edge === 'left' && 'rounded-l-none border-l-0',
          edge === 'right' && 'rounded-r-none border-r-0',
          (edge === 'top' || edge === 'bottom') && 'flex-row rounded-[26px]',
          edge === 'top' && 'rounded-t-none border-t-0',
          edge === 'bottom' && 'rounded-b-none border-b-0'
        )}
        onMouseEnter={requestExpand}
      >
        <div
          className={cn(
            'markdo-25d-inner flex h-full w-full items-center justify-center gap-1.5 overflow-hidden',
            (edge === 'left' || edge === 'right') && 'flex-col rounded-[23px]',
            edge === 'left' && 'rounded-l-none',
            edge === 'right' && 'rounded-r-none',
            (edge === 'top' || edge === 'bottom') && 'flex-row rounded-[23px]',
            edge === 'top' && 'rounded-t-none',
            edge === 'bottom' && 'rounded-b-none'
          )}
        >
          <span className="grid h-6 w-6 place-items-center">
            <Clipboard className="h-5 w-5 text-current" />
          </span>
          <strong
            className="grid h-6 w-6 place-items-center text-[17px] font-bold leading-none text-slate-900 dark:text-neutral-100"
            title={ocrStatus || `${openCount} 个待办`}
          >
            {openCount}
          </strong>
          <span className="grid h-6 w-6 place-items-center text-current">
            <ChevronsLeft
              className={cn(
                'h-4 w-4',
                edge === 'left' && 'rotate-180',
                edge === 'top' && '-rotate-90',
                edge === 'bottom' && 'rotate-90'
              )}
            />
          </span>
        </div>
      </section>

      <section
        className={cn(
          'markdo-panel-shell relative overflow-hidden rounded-panel',
          !showPanel && 'hidden',
          cssTransition === 'panel-collapse' && 'animate-css-panel-collapse',
          cssTransition === 'panel-enter' && 'animate-css-panel-enter'
        )}
      >
        <div className={cn('markdo-panel-fixed markdo-25d-outer relative overflow-hidden rounded-panel p-[3px] text-slate-950 dark:text-neutral-100', ocrFeedback)}>
          <EdgeGlow edge={edge} active={edgePreview} />
          <div className="markdo-25d-inner relative flex h-full w-full flex-col overflow-hidden rounded-[11px] p-[11px]">
            <div className="absolute inset-x-0 top-0 z-20 h-14 [-webkit-app-region:drag]" onPointerDown={beginWindowDrag} />
            <header className="relative z-30 mb-3 flex min-h-9 items-center justify-between [-webkit-app-region:drag]" onPointerDown={beginWindowDrag}>
            <div className="flex items-center gap-2">
              <img src={markdoLogo} alt="" className="h-7 w-7 rounded-[8px] object-cover shadow-sm" draggable={false} />
              <h1 className="text-xl font-semibold tracking-normal text-slate-950 dark:text-neutral-50">待办</h1>
            </div>
            <div className="flex items-center gap-1.5 [-webkit-app-region:no-drag]">
              <Button ref={settingsButtonRef} variant="ghost" size="icon" title="清单设置" onClick={() => setSettingsOpen((value) => !value)}>
                <SettingsIcon className="h-[18px] w-[18px]" />
              </Button>
              <Button variant="ghost" size="icon" title="收起到屏幕边缘" onClick={() => window.markdo.collapse()}>
                <ChevronsLeft className="h-[18px] w-[18px]" />
              </Button>
            </div>
          </header>

          {settingsOpen && (
            <div ref={settingsMenuRef} className="absolute right-4 top-16 z-40 grid w-56 max-w-[calc(100%-32px)] gap-1.5 rounded-card border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-850">
              {[
                { value: 'system', label: '跟随系统', icon: SunMoon },
                { value: 'light', label: '亮色', icon: Sun },
                { value: 'dark', label: '暗色', icon: Moon }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-control px-2 text-left text-slate-600 transition-colors hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700',
                      settings.theme === item.value && 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'
                    )}
                    onClick={() => setSettings((current) => ({ ...current, theme: item.value as Settings['theme'] }))}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-slate-200 dark:bg-neutral-700" />
              <div className="grid gap-1.5 px-1 text-xs text-slate-500 dark:text-neutral-400">
                <span>快速添加</span>
                <button
                  type="button"
                  className={cn(
                    'h-8 min-w-0 truncate rounded-control border border-slate-300 bg-white px-2 text-left text-xs text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100',
                    recordingShortcut === 'quickAdd' && 'border-primary text-primary dark:border-neutral-500 dark:text-white'
                  )}
                  title={displayShortcut(settings.quickAddShortcut)}
                  onClick={() => setRecordingShortcut('quickAdd')}
                  onKeyDown={formatShortcut}
                >
                  {recordingShortcut === 'quickAdd' ? '按下快捷键...' : displayShortcut(settings.quickAddShortcut)}
                </button>
                <span>OCR 快捷键</span>
                <button
                  type="button"
                  className={cn(
                    'h-8 min-w-0 truncate rounded-control border border-slate-300 bg-white px-2 text-left text-xs text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100',
                    recordingShortcut === 'ocr' && 'border-primary text-primary dark:border-neutral-500 dark:text-white'
                  )}
                  title={displayShortcut(settings.ocrShortcut)}
                  onClick={() => setRecordingShortcut('ocr')}
                  onKeyDown={formatShortcut}
                >
                  {recordingShortcut === 'ocr' ? '按下快捷键...' : displayShortcut(settings.ocrShortcut)}
                </button>
              </div>
            </div>
          )}

          <form className="relative z-10 mb-3 grid grid-cols-[1fr_48px] items-center gap-2" onSubmit={addTodo}>
            <Input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="快速添加待办..." autoComplete="off" />
            <Button type="submit" size="lgIcon" title="添加" className="rounded-control shadow-none">
              <Plus className="h-5 w-5" />
            </Button>
          </form>

          <section className={cn('relative z-10 flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto pb-28 pr-1', compact && 'gap-2')} aria-label="待办列表">
            {filter === 'deleted' ? (
              deletedTodos.length === 0 ? (
                <div className="grid h-44 place-items-center content-center gap-1 rounded-card border border-dashed border-slate-300 text-center text-sm text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
                  <strong className="font-semibold text-slate-700 dark:text-neutral-200">没有可恢复的待办</strong>
                  <span className="text-xs">删除后的待办会保留 72 小时</span>
                </div>
              ) : (
                deletedTodos.map((todo) => <DeletedTodoRow key={todo.id} todo={todo} onRestore={restoreTodo} />)
              )
            ) : visibleTodos.length === 0 ? (
              <div className="grid h-44 place-items-center content-center gap-1 rounded-card border border-dashed border-slate-300 text-center text-sm text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
                <strong className="font-semibold text-slate-700 dark:text-neutral-200">今天没有待办</strong>
                <span className="text-xs">输入一条任务，开始整理桌面工作流</span>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleTodoDragEnd}>
                <SortableContext items={visibleTodos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
                  {visibleTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={toggleTodo}
                      onTitleChange={(id, title) => updateTodo(id, { title: title.trim() || '未命名待办' })}
                      onDeadlineChange={(id, deadline) => updateTodo(id, { deadline })}
                      onOpenNote={(item) => window.markdo.openNote(item)}
                      onDelete={softDeleteTodo}
                      closeToken={closePopupsToken}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </section>

          <footer className="relative z-10 mt-3 grid min-h-[44px] grid-cols-[auto_auto_auto_1fr_auto] items-center gap-2.5 rounded-control border border-slate-200 bg-white/55 px-3 text-sm text-slate-600 dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-300">
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-neutral-200">
              <CheckCircle2 className="h-4 w-4" />
              全部
            </span>
            <span>{todos.length}</span>
            <span className="h-4 w-px bg-slate-300" />
            <span>未完成 {openCount}</span>
            <div className="relative justify-self-end">
              {filterOpen && (
                <div
                  ref={filterMenuRef}
                  className="absolute bottom-8 right-0 z-40 grid w-36 gap-1 rounded-card border border-slate-200 bg-white p-1.5 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-850"
                >
                  {[
                    { value: 'all', label: '全部' },
                    { value: 'open', label: '未完成' },
                    { value: 'done', label: '已完成' },
                    { value: 'deleted', label: `已删除 ${deletedCount}` }
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        'h-8 rounded-control px-2 text-left text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700',
                        filter === item.value && 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'
                      )}
                      onClick={() => selectFilter(item.value as FilterMode)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                ref={filterButtonRef}
                type="button"
                className="inline-flex items-center gap-1.5 text-slate-700 dark:text-neutral-200"
                onClick={() => setFilterOpen((value) => !value)}
              >
              <span>{filter === 'all' ? '清单视图' : filter === 'open' ? '未完成' : filter === 'done' ? '已完成' : `已删除 ${deletedCount}`}</span>
              <List className="h-4 w-4" />
              </button>
            </div>
          </footer>
          </div>
        </div>
      </section>
    </main>
  );
}

function DeletedTodoRow({ todo, onRestore }: { todo: DeletedTodo; onRestore: (id: string) => void }) {
  const deletedAt = new Date(todo.deletedAt);
  const expireAt = new Date(deletedAt.getTime() + 72 * 60 * 60 * 1000);
  return (
    <div
      className="grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-3 rounded-card border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-850"
      style={{ viewTransitionName: `todo-${todo.id}` } as CSSProperties}
    >
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-neutral-100">{todo.title}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
          可恢复至 {expireAt.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} {expireAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => onRestore(todo.id)} className="gap-1.5">
        <RotateCcw className="h-3.5 w-3.5" />
        恢复
      </Button>
    </div>
  );
}

function deadlineSort(todo: TodoItem) {
  return todo.deadline ? new Date(todo.deadline).getTime() : Number.MAX_SAFE_INTEGER;
}

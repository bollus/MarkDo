import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Info } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { cn } from '../lib/utils';
import { formatDeadline, formatElapsed, urgency } from '../lib/date';

type TodoItemProps = {
  todo: TodoItem;
  onToggle: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onDeadlineChange: (id: string, deadline: string | null) => void;
  onOpenNote: (todo: TodoItem) => void;
  onDelete: (id: string) => void;
  closeToken?: number;
};

const urgencyClass: Record<string, string> = {
  hot: 'border-rose-200 bg-rose-50 dark:border-neutral-700 dark:bg-neutral-850',
  warm: 'border-orange-200 bg-orange-50 dark:border-neutral-700 dark:bg-neutral-850',
  calm: 'border-yellow-200 bg-yellow-50 dark:border-neutral-700 dark:bg-neutral-850',
  soft: 'border-emerald-200 bg-emerald-50 dark:border-neutral-700 dark:bg-neutral-850',
  none: 'border-slate-200 bg-slate-50 dark:border-neutral-700 dark:bg-neutral-850',
  done: 'border-slate-200 bg-slate-100 dark:border-neutral-800 dark:bg-neutral-800'
};

export function TodoItem({
  todo,
  onToggle,
  onTitleChange,
  onDeadlineChange,
  onOpenNote,
  onDelete,
  closeToken
}: TodoItemProps) {
  const [dragX, setDragX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const start = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const suppressClick = useRef(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });

  const tone = urgency(todo);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(todo.title);
  }, [editingTitle, todo.title]);

  useEffect(() => undefined, [closeToken]);

  function beginSwipe(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('input,[data-no-swipe]')) return;
    start.current = { x: event.clientX, y: event.clientY };
    dragged.current = false;
    setDragX(0);
    setIsSwiping(true);
  }

  function moveSwipe(event: React.PointerEvent<HTMLDivElement>) {
    if (!isSwiping) return;
    const moveY = Math.abs(event.clientY - start.current.y);
    if (moveY > 22) return;
    const nextX = Math.min(0, Math.max(-132, event.clientX - start.current.x));
    if (Math.abs(nextX) > 5) {
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragX(nextX);
  }

  function finishSwipe() {
    if (!isSwiping) return;
    const shouldDelete = dragX <= -108;
    setIsSwiping(false);
    if (shouldDelete) {
      onDelete(todo.id);
    } else {
      setDragX(0);
      if (dragged.current) {
        suppressClick.current = true;
        window.setTimeout(() => {
          dragged.current = false;
          suppressClick.current = false;
        }, 120);
      }
    }
  }

  function stopClickAfterSwipe(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function commitTitle() {
    const nextTitle = titleDraft.trim();
    onTitleChange(todo.id, nextTitle || todo.title || '未命名待办');
    setEditingTitle(false);
  }

  function openDeadlinePicker(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    window.markdo.openDeadlinePicker({
      id: todo.id,
      deadline: todo.deadline,
      anchor: {
        left: window.screenX + rect.left,
        top: window.screenY + rect.top,
        right: window.screenX + rect.right,
        bottom: window.screenY + rect.bottom
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      data-todo-id={todo.id}
      className={cn('relative overflow-visible rounded-card select-none', isDragging && 'z-40')}
      style={
        {
          transform: CSS.Transform.toString(transform),
          transition: isDragging ? undefined : transition
        } as CSSProperties
      }
    >
      <div
        className="absolute inset-0 flex items-center justify-end rounded-card bg-red-500 pr-4 text-sm font-semibold text-white"
        style={{ opacity: dragX < 0 ? 1 : 0 }}
      >
        删除
      </div>
      <Card
        className={cn(
          'relative grid min-h-[70px] grid-cols-[12px_22px_1fr_28px] grid-rows-[auto_auto] items-start gap-x-2.5 gap-y-1.5 px-3 py-2.5 transition-colors duration-150 hover:brightness-[0.98] dark:hover:brightness-110',
          urgencyClass[tone],
          todo.done && 'opacity-60',
          isDragging && 'brightness-[0.97] shadow-lg dark:brightness-110'
        )}
        style={
          {
            transform: `translateX(${dragX}px)`,
            transition: isSwiping ? 'none' : 'transform 100ms ease',
            viewTransitionName: `todo-${todo.id}`
          } as CSSProperties
        }
        onPointerDown={beginSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
        onClickCapture={stopClickAfterSwipe}
      >
        <div
          aria-label="拖动排序"
          title="拖动排序"
          data-no-swipe
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="row-span-2 h-8 w-3 cursor-grab self-center opacity-45 active:cursor-grabbing [background-image:radial-gradient(circle,#94a3b8_1.2px,transparent_1.3px)] [background-size:5px_6px]"
        />
        <button
          type="button"
          aria-label="完成"
          title="完成"
          data-no-swipe
          onClick={() => onToggle(todo.id)}
          className={cn(
            'mt-[1px] h-[22px] w-[22px] rounded-md border-2 border-slate-300 bg-white/80',
            todo.done && 'border-primary bg-primary shadow-[inset_0_0_0_4px_white]'
          )}
        />
        {editingTitle ? (
          <input
            aria-label="编辑待办标题"
            value={titleDraft}
            autoFocus
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitle();
              if (event.key === 'Escape') {
                setTitleDraft(todo.title);
                setEditingTitle(false);
              }
            }}
            data-no-swipe
            className="h-[22px] min-w-0 select-text bg-transparent p-0 text-[15px] font-semibold leading-[22px] text-slate-900 outline-none dark:text-neutral-100"
          />
        ) : (
          <button
            type="button"
            title="双击编辑"
            onDoubleClick={() => setEditingTitle(true)}
            className="h-[22px] min-w-0 truncate bg-transparent p-0 text-left text-[15px] font-semibold leading-[22px] text-slate-900 dark:text-neutral-100"
          >
            {todo.title}
          </button>
        )}
        <button
          type="button"
          aria-label="打开备注"
          title="打开备注"
          onClick={() => onOpenNote(todo)}
          className="col-start-4 row-span-2 self-center text-slate-600 transition-colors hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
        >
          <Info className="h-[18px] w-[18px]" />
        </button>
        <div className="col-start-2 col-end-4 row-start-2 flex items-center justify-between gap-3 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5" />
            {formatElapsed(todo.createdAt)}
          </span>
          <div
            className={cn(
              'relative inline-flex items-center whitespace-nowrap',
              tone === 'hot' && 'text-rose-600',
              tone === 'warm' && 'text-orange-600',
              tone === 'calm' && 'text-yellow-700',
              tone === 'soft' && 'text-emerald-600'
            )}
          >
            <button type="button" className="text-current" onClick={openDeadlinePicker}>
              {formatDeadline(todo.deadline)}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

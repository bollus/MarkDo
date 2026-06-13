/// <reference types="vite/client" />

type DockEdge = 'left' | 'right' | 'top' | 'bottom';

type TodoItem = {
  id: string;
  title: string;
  deadline: string | null;
  summary: string;
  details: string;
  screenshotDataUrl?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

type WindowDockState = {
  collapsed: boolean;
  edge: DockEdge;
  docked?: boolean;
  dragging?: boolean;
};

interface Window {
  markdo: {
    platform: string;
    collapse: (edge?: DockEdge) => Promise<void>;
    expand: () => Promise<void>;
    collapseIfDocked: () => Promise<void>;
    minimize: () => Promise<void>;
    close: () => Promise<void>;
    minimizeCurrent: () => Promise<void>;
    closeCurrent: () => Promise<void>;
    hideCurrent: () => Promise<void>;
    setAlwaysOnTop: (value: boolean) => Promise<void>;
    dragStart: () => Promise<void>;
    dragEnd: () => Promise<void>;
    openNote: (todo: TodoItem) => Promise<void>;
    openImage: (dataUrl: string) => Promise<void>;
    openDeadlinePicker: (payload: { id: string; deadline: string | null; anchor: { left: number; top: number; right: number; bottom: number } }) => Promise<void>;
    saveNote: (payload: Pick<TodoItem, 'id' | 'summary' | 'details'>) => void;
    saveDeadline: (payload: Pick<TodoItem, 'id' | 'deadline'>) => void;
    setOcrShortcut: (shortcut: string) => Promise<boolean>;
    setQuickAddShortcut: (shortcut: string) => Promise<boolean>;
    createQuickTodo: (todo: TodoItem) => void;
    runOcr: () => Promise<void>;
    finishOcrSelection: (rect: { x: number; y: number; width: number; height: number }) => void;
    cancelOcrSelection: () => void;
    onCollapsed: (callback: (state: WindowDockState) => void) => void;
    onClosePopups: (callback: () => void) => void;
    onOpenSettings: (callback: () => void) => void;
    onCollapseVisual: (callback: (state: { mode: 'panel-collapse' | 'strip-enter' | 'strip-collapse' | 'panel-enter' | 'blank'; edge: DockEdge }) => void) => void;
    onNoteInit: (callback: (todo: TodoItem) => void) => void;
    onNoteUpdated: (callback: (payload: Pick<TodoItem, 'id' | 'summary' | 'details'>) => void) => void;
    onDeadlineInit: (callback: (payload: Pick<TodoItem, 'id' | 'deadline'>) => void) => void;
    onDeadlineUpdated: (callback: (payload: Pick<TodoItem, 'id' | 'deadline'>) => void) => void;
    onOcrTodo: (callback: (todo: TodoItem) => void) => void;
    onOcrStatus: (callback: (message: string) => void) => void;
    onShortcutStatus: (callback: (message: string) => void) => void;
    onQuickAddTodo: (callback: (todo: TodoItem) => void) => void;
    onQuickAdd: (callback: () => void) => void;
    onQuickAddOpen: (callback: () => void) => void;
  };
}

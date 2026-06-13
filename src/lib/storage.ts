import { todayAt, tomorrowAt } from './date';

const STORAGE_KEY = 'markdo.todos.v1';
const DELETED_STORAGE_KEY = 'markdo.deletedTodos.v1';
const SETTINGS_KEY = 'markdo.settings.v1';
const DELETED_RETENTION_MS = 72 * 60 * 60 * 1000;

export type DeletedTodo = TodoItem & {
  deletedAt: string;
};

export type Settings = {
  defaultDuration?: number;
  theme: 'light' | 'dark' | 'system';
  ocrShortcut: string;
  quickAddShortcut: string;
};

export function createTodo(title: string, deadline: string | null = null, summary = '', details = '', screenshotDataUrl?: string): TodoItem {
  return {
    id: crypto.randomUUID(),
    title,
    deadline,
    summary,
    details,
    screenshotDataUrl,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeTodo(raw: Partial<TodoItem> & { duration?: number }): TodoItem {
  return {
    id: raw.id || crypto.randomUUID(),
    title: raw.title || '未命名待办',
    deadline: raw.deadline ?? null,
    summary: raw.summary || '',
    details: raw.details || '',
    screenshotDataUrl: raw.screenshotDataUrl,
    done: Boolean(raw.done),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString()
  };
}

function normalizeDeletedTodo(raw: Partial<DeletedTodo> & { duration?: number }): DeletedTodo | null {
  const deletedAt = raw.deletedAt || new Date().toISOString();
  if (Date.now() - new Date(deletedAt).getTime() > DELETED_RETENTION_MS) return null;
  return {
    ...normalizeTodo(raw),
    deletedAt
  };
}

export function loadTodos(): TodoItem[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Array<Partial<TodoItem> & { duration?: number }>;
      return parsed.map(normalizeTodo);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return [
    createTodo('提交周报', todayAt(18, 30), '本周进展、问题和下周计划。'),
    createTodo('给客户回邮件', todayAt(16, 0), '确认交付时间和报价范围。'),
    createTodo('设计评审准备', tomorrowAt(9, 0), ''),
    createTodo('阅读产品文档', null, '')
  ];
}

export function saveTodos(todos: TodoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export function loadDeletedTodos(): DeletedTodo[] {
  const saved = localStorage.getItem(DELETED_STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as Array<Partial<DeletedTodo> & { duration?: number }>;
    return parsed
      .map(normalizeDeletedTodo)
      .filter((todo): todo is DeletedTodo => Boolean(todo))
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  } catch {
    localStorage.removeItem(DELETED_STORAGE_KEY);
    return [];
  }
}

export function saveDeletedTodos(todos: DeletedTodo[]) {
  const retained = todos.filter((todo) => Date.now() - new Date(todo.deletedAt).getTime() <= DELETED_RETENTION_MS);
  localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(retained));
}

export function loadSettings(): Settings {
  const saved = localStorage.getItem(SETTINGS_KEY);
  const defaults = {
    defaultDuration: 25,
    theme: 'system' as const,
    ocrShortcut: 'CommandOrControl+Shift+O',
    quickAddShortcut: 'CommandOrControl+Shift+Space'
  };
  if (!saved) return defaults;
  return { ...defaults, ...JSON.parse(saved) };
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

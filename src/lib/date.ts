export function todayAt(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function tomorrowAt(hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function isTomorrow(date: Date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(date, tomorrow);
}

export function formatElapsed(createdAt?: string) {
  const started = new Date(createdAt || Date.now());
  const minutes = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
  if (minutes < 1) return '刚刚开始';
  if (minutes < 60) return `已用 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `已用 ${hours} 小时 ${rest} 分钟` : `已用 ${hours} 小时`;
}

export function formatDeadline(value: string | null) {
  if (!value) return '无截止时间';
  const date = new Date(value);
  const day = isSameDay(date, new Date())
    ? '今天'
    : isTomorrow(date)
      ? '明天'
      : `${date.getMonth() + 1}/${date.getDate()}`;
  return `${day} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function urgency(todo: TodoItem) {
  if (todo.done) return 'done';
  if (!todo.deadline) return 'none';
  const deadline = new Date(todo.deadline);
  const minutes = (deadline.getTime() - Date.now()) / 60000;
  if (minutes < 0) return 'hot';
  if (minutes <= 120) return 'hot';
  if (isSameDay(deadline, new Date())) return 'warm';
  if (isTomorrow(deadline)) return 'calm';
  return 'soft';
}

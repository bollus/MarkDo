import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { forwardRef, type HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { fromDateTimeLocal, isSameDay, toDateTimeLocal } from '../lib/date';
import { cn } from '../lib/utils';

type DeadlinePickerProps = {
  value: string | null;
  onConfirm: (value: string | null) => void;
  onCancel?: () => void;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];
const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
type CalendarMode = 'day' | 'month' | 'year';

function two(value: number) {
  return String(value).padStart(2, '0');
}

function parseLocal(value: string) {
  const date = value ? new Date(value) : new Date();
  date.setSeconds(0, 0);
  return {
    selected: date,
    hour: date.getHours(),
    minute: Math.floor(date.getMinutes() / 5) * 5
  };
}

function localDateTime(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(hour)}:${two(minute)}`;
}

function monthDays(viewMonth: Date) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function applyYearMonth(date: Date, year: number, month: number) {
  const next = new Date(date);
  next.setFullYear(year, month, Math.min(date.getDate(), daysInMonth(year, month)));
  return next;
}

function clampTime(value: number, max: number) {
  if (value < 0) return max;
  if (value > max) return 0;
  return value;
}

function TimeUnit({
  label,
  value,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const wheelCarry = useRef(0);
  const lastWheelAt = useRef(0);

  function change(delta: number) {
    onChange(clampTime(value + delta, max));
  }

  return (
    <div
      className="grid justify-items-center gap-1"
      onWheel={(event) => {
        event.preventDefault();
        const now = Date.now();
        if (now - lastWheelAt.current < 80) return;
        wheelCarry.current += event.deltaY;
        if (Math.abs(wheelCarry.current) < 20) return;
        lastWheelAt.current = now;
        change(wheelCarry.current > 0 ? -step : step);
        wheelCarry.current = 0;
      }}
    >
      <button type="button" aria-label={`${label}增加`} className="grid h-6 w-8 place-items-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white" onClick={() => change(step)}>
        <ChevronUp className="h-4 w-4" />
      </button>
      <div className="grid h-10 w-12 place-items-center rounded-control border border-slate-200 bg-white text-sm tabular-nums text-slate-900 dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-100">
        {two(value)}
      </div>
      <button type="button" aria-label={`${label}减少`} className="grid h-6 w-8 place-items-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white" onClick={() => change(-step)}>
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

export const DeadlinePicker = forwardRef<HTMLDivElement, DeadlinePickerProps>(function DeadlinePicker(
  { value, onConfirm, onCancel: _onCancel, className, ...props },
  ref
) {
  const initial = useMemo(() => parseLocal(toDateTimeLocal(value)), [value]);
  const [selectedDate, setSelectedDate] = useState(initial.selected);
  const [viewMonth, setViewMonth] = useState(new Date(initial.selected.getFullYear(), initial.selected.getMonth(), 1));
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('day');
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const days = monthDays(viewMonth);
  const today = new Date();
  const yearPageStart = Math.floor(viewMonth.getFullYear() / 12) * 12;
  const years = Array.from({ length: 12 }, (_, index) => yearPageStart + index);

  useEffect(() => {
    const next = parseLocal(toDateTimeLocal(value));
    setSelectedDate(next.selected);
    setViewMonth(new Date(next.selected.getFullYear(), next.selected.getMonth(), 1));
    setCalendarMode('day');
    setHour(next.hour);
    setMinute(next.minute);
  }, [value]);

  function moveCalendar(delta: number) {
    setViewMonth((current) => {
      if (calendarMode === 'day') return new Date(current.getFullYear(), current.getMonth() + delta, 1);
      if (calendarMode === 'month') return new Date(current.getFullYear() + delta, current.getMonth(), 1);
      return new Date(current.getFullYear() + delta * 12, current.getMonth(), 1);
    });
  }

  function openParentMode() {
    setCalendarMode((current) => (current === 'day' ? 'month' : current === 'month' ? 'year' : 'year'));
  }

  function selectYear(year: number) {
    setViewMonth((current) => new Date(year, current.getMonth(), 1));
    setSelectedDate((current) => applyYearMonth(current, year, current.getMonth()));
    setCalendarMode('month');
  }

  function selectMonth(month: number) {
    setViewMonth((current) => new Date(current.getFullYear(), month, 1));
    setSelectedDate((current) => applyYearMonth(current, viewMonth.getFullYear(), month));
    setCalendarMode('day');
  }

  function selectDay(date: Date) {
    setSelectedDate(date);
    setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function headerLabel() {
    if (calendarMode === 'day') return `${viewMonth.getFullYear()}年${viewMonth.getMonth() + 1}月`;
    if (calendarMode === 'month') return `${viewMonth.getFullYear()}年`;
    return `${yearPageStart}年 - ${yearPageStart + 11}年`;
  }

  function updateTime(value: string) {
    const [nextHour, nextMinute] = value.split(':').map((part) => Number(part));
    if (Number.isFinite(nextHour)) setHour(clampTime(nextHour, 23));
    if (Number.isFinite(nextMinute)) setMinute(clampTime(nextMinute, 59));
  }

  return (
    <div
      className={cn(
        'grid w-[410px] grid-cols-[1fr_130px] overflow-hidden rounded-card border border-slate-200 bg-white text-slate-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-200',
        className
      )}
      ref={ref}
      {...props}
    >
      <div className="p-3">
        <div className="mb-2 grid grid-cols-[32px_1fr_32px] items-center">
          <button type="button" aria-label="上一页" className="grid h-8 w-8 place-items-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white" onClick={() => moveCalendar(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-8 rounded-control text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
            onClick={openParentMode}
          >
            {headerLabel()}
          </button>
          <button type="button" aria-label="下一页" className="grid h-8 w-8 place-items-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white" onClick={() => moveCalendar(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {calendarMode === 'day' && (
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {weekLabels.map((label) => (
              <div key={label} className="h-6 text-xs font-medium leading-6 text-slate-500 dark:text-neutral-400">
                {label}
              </div>
            ))}
            {days.map((date) => {
              const currentMonth = date.getMonth() === viewMonth.getMonth();
              const selected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={cn(
                    'mx-auto grid h-8 w-8 place-items-center rounded-full text-[13px] tabular-nums transition-colors',
                    currentMonth ? 'text-slate-800 hover:bg-slate-100 dark:text-neutral-100 dark:hover:bg-neutral-700' : 'text-slate-300 dark:text-neutral-600',
                    isToday && !selected && 'border border-primary/45 text-primary',
                    selected && 'bg-primary text-white shadow-[0_4px_10px_rgba(37,99,235,.26)] hover:bg-primary'
                  )}
                  onClick={() => selectDay(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        )}

        {calendarMode === 'month' && (
          <div className="grid h-[248px] grid-cols-3 content-center gap-2">
            {monthLabels.map((label, month) => {
              const selected = selectedDate.getFullYear() === viewMonth.getFullYear() && selectedDate.getMonth() === month;
              return (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    'h-12 rounded-control text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-neutral-700',
                    selected ? 'bg-primary text-white shadow-[0_4px_10px_rgba(37,99,235,.22)] hover:bg-primary' : 'text-slate-700 dark:text-neutral-100'
                  )}
                  onClick={() => selectMonth(month)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {calendarMode === 'year' && (
          <div className="grid h-[248px] grid-cols-3 content-center gap-2">
            {years.map((year) => {
              const selected = selectedDate.getFullYear() === year;
              const currentYear = today.getFullYear() === year;
              return (
                <button
                  key={year}
                  type="button"
                  className={cn(
                    'h-12 rounded-control text-sm font-medium tabular-nums transition-colors hover:bg-slate-100 dark:hover:bg-neutral-700',
                    currentYear && !selected && 'border border-primary/45 text-primary',
                    selected ? 'bg-primary text-white shadow-[0_4px_10px_rgba(37,99,235,.22)] hover:bg-primary' : 'text-slate-700 dark:text-neutral-100'
                  )}
                  onClick={() => selectYear(year)}
                >
                  {year}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid border-l border-slate-200 p-3 dark:border-neutral-700">
        <div className="text-sm font-medium text-slate-800 dark:text-neutral-100">时间</div>
        <input
          type="time"
          value={`${two(hour)}:${two(minute)}`}
          step={300}
          onChange={(event) => updateTime(event.target.value)}
          className="time-input-clean mt-2 h-10 rounded-control border border-slate-200 bg-white px-3 text-center text-sm tabular-nums text-slate-900 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10 dark:border-neutral-700 dark:bg-neutral-850 dark:text-neutral-100"
        />
        <div className="mt-4 flex items-center justify-center gap-1">
          <TimeUnit label="小时" value={hour} max={23} onChange={setHour} />
          <span className="pt-1 text-lg font-semibold text-slate-400 dark:text-neutral-500">:</span>
          <TimeUnit label="分钟" value={minute} max={59} step={5} onChange={setMinute} />
        </div>
        <div className="mt-auto grid gap-2">
          <button type="button" className="h-9 rounded-control bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover" onClick={() => onConfirm(fromDateTimeLocal(localDateTime(selectedDate, hour, minute)))}>
            确定
          </button>
          <button type="button" className="h-7 text-xs text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-100" onClick={() => onConfirm(null)}>
            清除截止时间
          </button>
        </div>
      </div>
    </div>
  );
});

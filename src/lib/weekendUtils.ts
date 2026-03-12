import { getLocalDateString } from './dateUtils';

export type WeekendMode = 'weekday' | 'saturday' | 'sunday';

function parseLocalDateString(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToLocalDate(dateString: string, days: number): string {
  const date = parseLocalDateString(dateString);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function getWeekStartDateForLocalDate(dateString: string): string {
  const date = parseLocalDateString(dateString);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatLocalDate(date);
}

export function getWeekendModeFromLocalDate(dateString: string): WeekendMode {
  const day = parseLocalDateString(dateString).getDay();
  if (day === 6) return 'saturday';
  if (day === 0) return 'sunday';
  return 'weekday';
}

export function getCurrentWeekendMode(): WeekendMode {
  return getWeekendModeFromLocalDate(getLocalDateString());
}

export function getWeekdayLabel(dateString: string): string {
  return parseLocalDateString(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
  });
}

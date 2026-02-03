// src/lib/dateUtils.ts
// Date utility functions for scheduled album feature

/**
 * Get the current date in YYYY-MM-DD format using device's local timezone
 * This is the primary function for determining "today" for album display
 */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if the day has changed since the last checked date
 * Used to detect midnight transitions
 */
export function isNewDay(lastCheckedDate: string | null): boolean {
  if (!lastCheckedDate) return true;
  return getLocalDateString() !== lastCheckedDate;
}

/**
 * Format a date string for display (e.g., "Mon, Feb 10")
 */
export function formatScheduledDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00'); // Ensure local timezone interpretation
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string for long display (e.g., "Monday, February 10, 2026")
 */
export function formatScheduledDateLong(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get relative day description (e.g., "today", "tomorrow", "in 3 days")
 */
export function getRelativeDayDescription(dateString: string): string {
  const targetDate = new Date(dateString + 'T00:00:00');
  const today = new Date(getLocalDateString() + 'T00:00:00');
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `in ${diffDays} days`;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(dateString: string): boolean {
  const date = new Date(dateString + 'T00:00:00');
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const targetDate = new Date(dateString + 'T00:00:00');
  const today = new Date(getLocalDateString() + 'T00:00:00');
  return targetDate < today;
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getLocalDateString();
}

/**
 * Get the next valid weekday (Mon-Fri) from a given date
 */
export function getNextWeekday(fromDate?: string): string {
  const date = fromDate 
    ? new Date(fromDate + 'T00:00:00') 
    : new Date(getLocalDateString() + 'T00:00:00');
  
  // Move to tomorrow first
  date.setDate(date.getDate() + 1);
  
  // Skip weekends
  while (isWeekend(formatDateToString(date))) {
    date.setDate(date.getDate() + 1);
  }
  
  return formatDateToString(date);
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date object (in local timezone)
 */
export function parseDateString(dateString: string): Date {
  return new Date(dateString + 'T00:00:00');
}

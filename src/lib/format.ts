import { formatDistanceToNow } from 'date-fns';

export function formatRelativeTime(value: Date | string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function clampText(text: string, maxChars = 320) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trim()}…`;
}

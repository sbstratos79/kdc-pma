export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  try {
    return new Date(dateString).toLocaleDateString('IN');
  } catch {
    return 'Invalid date';
  }
}
export function parseDate(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function dateToIso(d: Date | string | null) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'string') {
    // assume user typed ISO or readable string — try to parse
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

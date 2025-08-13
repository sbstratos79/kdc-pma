export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  try {
    return new Date(dateString).toLocaleDateString('IN');
  } catch {
    return 'Invalid date';
  }
}

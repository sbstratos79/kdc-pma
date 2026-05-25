export function getStatusColor(status: string | null): string {
  const statusLower = status ? status : '';
  switch (statusLower) {
    case 'Completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'In Progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Planning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'On Hold':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'Cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function getPriorityColor(priority: string | null): string {
  const priorityLower = priority;
  switch (priorityLower) {
    case 'High':
      return 'bg-red-400 text-black font-bold border-red-900';
    case 'Medium':
      return 'bg-yellow-500 text-black font-bold border-red-900';
    case 'Low':
      return 'bg-green-500 text-black font-bold border-red-900';
    default:
      return 'bg-gray-500 text-black font-bold border-red-900';
  }
}

export function getStatusBarColor(status: string | null): string {
  const s = (status ?? '').toLowerCase();
  switch (s) {
    case 'completed':
      return 'bg-gradient-to-b from-green-600 via-green-700 to-green-800';
    case 'in progress':
      return 'bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800';
    case 'planning':
      return 'bg-gradient-to-b from-amber-600 via-amber-700 to-amber-800';
    case 'on hold':
      return 'bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800';
    case 'cancelled':
      return 'bg-gradient-to-b from-red-600 via-red-700 to-red-800';
    default:
      return 'bg-gradient-to-b from-gray-500 via-gray-600 to-gray-700';
  }
}

export function getPriorityGradient(priority: string) {
  switch (priority?.toLowerCase()) {
    case 'high':
      return 'from-red-200/100 to-white';
    case 'medium':
      return 'from-yellow-200/70 to-white';
    case 'low':
      return 'from-green-200/70 to-white';
    default:
      return 'from-gray-50/50 to-white';
  }
}

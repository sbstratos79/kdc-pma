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
      return 'bg-red-500';
    case 'Medium':
      return 'bg-yellow-500';
    case 'Low':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

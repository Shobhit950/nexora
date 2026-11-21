export function DashboardAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase() || '?';

  return <span className="dashboard-avatar" aria-hidden="true">{initials}</span>;
}

import { Cable, Hexagon, History, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings, Workflow, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { User } from '../../auth/api';
import { DashboardAvatar } from './DashboardAvatar';

const upcomingNavigation = [
  { label: 'Executions', icon: History },
  { label: 'Integrations', icon: Cable },
  { label: 'Settings', icon: Settings },
];

type SidebarProps = {
  user: User;
  collapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
};

export function DashboardSidebar({ user, collapsed = false, onToggle, onClose }: SidebarProps) {
  return (
    <div className="dashboard-sidebar-content" data-compact={collapsed}>
      <div className="dashboard-brand-row">
        <div className="wordmark dashboard-brand">
          <span className="brand-mark" aria-hidden="true">
            <Hexagon size={22} strokeWidth={2.5} />
            <Workflow size={12} strokeWidth={2.5} />
          </span>
          <span className="dashboard-brand-name">Nexora<span className="dashboard-brand-dot" aria-hidden="true">.</span></span>
        </div>
        {onToggle && (
          <button
            className="dashboard-icon-button dashboard-collapse"
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
        {onClose && (
          <button className="dashboard-icon-button" type="button" aria-label="Close navigation" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="dashboard-nav" aria-label="Workspace">
        <NavLink
          to="/dashboard"
          end
          onClick={onClose}
          className="dashboard-nav-item"
          aria-label="Dashboard"
        >
          <LayoutDashboard size={19} aria-hidden="true" />
          <span className="dashboard-nav-label" aria-hidden="true">Dashboard</span>
          {collapsed && <span className="dashboard-sidebar-tip" aria-hidden="true">Dashboard</span>}
        </NavLink>
        <NavLink to="/dashboard/workflows" onClick={onClose} className="dashboard-nav-item" aria-label="My Workflows">
          <Workflow size={19} aria-hidden="true" />
          <span className="dashboard-nav-label" aria-hidden="true">My Workflows</span>
          {collapsed && <span className="dashboard-sidebar-tip" aria-hidden="true">My Workflows</span>}
        </NavLink>
        {upcomingNavigation.map(({ label, icon: Icon }) => (
          <div key={label} className="dashboard-nav-item dashboard-nav-upcoming"
            role={collapsed ? 'group' : undefined}
            tabIndex={collapsed ? 0 : undefined}
            aria-label={collapsed ? label + ', coming soon' : undefined}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="dashboard-nav-label" aria-hidden={collapsed || undefined}>{label}</span>
            <span className="dashboard-soon" aria-hidden={collapsed || undefined}>Soon</span>
            {collapsed && <span className="dashboard-sidebar-tip" aria-hidden="true">{label} · Coming soon</span>}
          </div>
        ))}
      </nav>

      <div className="dashboard-sidebar-account" role="group" aria-label={user.name + ', ' + user.email}
        tabIndex={collapsed ? 0 : undefined}
      >
        <DashboardAvatar name={user.name} />
        <div className="dashboard-sidebar-identity" aria-hidden="true">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        {collapsed && <span className="dashboard-sidebar-tip" aria-hidden="true">{user.name} · {user.email}</span>}
      </div>
    </div>
  );
}

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar';
import './dashboard.css';

export type DashboardOutletContext = {
  setHasUnsavedChanges: (dirty: boolean) => void;
  setEditorFocus: (focused: boolean) => void;
};

export function DashboardLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorFocus, setEditorFocus] = useState(false);
  const reducedMotion = useReducedMotion();
  const drawer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    function closeOnDesktop() {
      if (desktop.matches) drawer.current?.close();
    }

    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  if (!user) return null;

  function closeDrawer() {
    drawer.current?.close();
  }

  return (
    <div className="dashboard-shell" data-editor-focus={editorFocus}>
      <a className="dashboard-skip-link" href="#dashboard-main">Skip to content</a>
      <motion.aside
        className="dashboard-sidebar"
        initial={false}
        animate={{ width: collapsed ? 72 : 224 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 42 }}
      >
        <DashboardSidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </motion.aside>
      <dialog
        ref={drawer}
        className="dashboard-drawer"
        aria-label="Workspace navigation"
        onClick={event => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <DashboardSidebar user={user} onClose={closeDrawer} />
      </dialog>
      <div className="dashboard-body">
        <DashboardHeader user={user} hasUnsavedChanges={hasUnsavedChanges} onOpenNavigation={() => drawer.current?.showModal()} />
        <main className="dashboard-main" id="dashboard-main" tabIndex={-1}>
          <Outlet context={{ setHasUnsavedChanges, setEditorFocus } satisfies DashboardOutletContext} />
        </main>
      </div>
    </div>
  );
}

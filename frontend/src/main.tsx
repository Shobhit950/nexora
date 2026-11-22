import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@fontsource-variable/space-grotesk';
import { AuthGate } from './auth/AuthGate';
import { AuthProvider } from './auth/AuthProvider';
import { PlaceholderPage } from './components/PlaceholderPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthPage } from './pages/AuthPage';
import './styles.css';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout').then(module => ({ default: module.DashboardLayout })));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage').then(module => ({ default: module.WorkflowsPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AuthGate />}>
            <Route path="/login" element={<AuthPage key="login" mode="login" />} />
            <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
          </Route>
          <Route element={<AuthGate protectedRoute />}>
            <Route element={
              <Suspense fallback={<p role="status">Loading dashboard…</p>}>
                <DashboardLayout />
              </Suspense>
            }>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/workflows" element={<WorkflowsPage />} />
            </Route>
          </Route>
          <Route path="/" element={<Suspense><LandingPage /></Suspense>} />
          <Route element={<AppLayout />}>
            <Route path="*" element={<PlaceholderPage title="Page not found" description="Choose a page from the navigation." />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

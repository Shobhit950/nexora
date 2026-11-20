import { createBrowserRouter, Navigate } from 'react-router'
import { PlaceholderPage } from '../components/PlaceholderPage'
import { AppLayout } from '../layouts/AppLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { SignupPage } from '../pages/SignupPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: '*',
        element: <PlaceholderPage title="Page not found" description="Choose a page from the navigation." />,
      },
    ],
  },
])

import { Link, NavLink, Outlet } from 'react-router'

const navigation = [
  { to: '/login', label: 'Log in' },
  { to: '/signup', label: 'Sign up' },
  { to: '/dashboard', label: 'Dashboard' },
]

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Nexora
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-1">
            {navigation.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <Outlet />
      </main>
    </div>
  )
}

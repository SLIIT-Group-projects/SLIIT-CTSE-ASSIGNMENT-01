import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function navForRole(role) {
  const nav = [{ to: '/dashboard', label: 'Dashboard', icon: 'grid' }];
  if (role === 'PATIENT') {
    nav.push({ to: '/appointments', label: 'Appointments', icon: 'calendar' });
    nav.push({ to: '/billing', label: 'Billing', icon: 'wallet' });
    nav.push({ to: '/lab', label: 'Lab Reports', icon: 'report' });
  }
  if (role === 'DOCTOR') {
    nav.push({ to: '/doctor', label: 'Doctor Availability', icon: 'stethoscope' });
    nav.push({ to: '/doctor/appointments', label: 'Confirmed Appointments', icon: 'calendar' });
    nav.push({ to: '/doctor/history', label: 'Appointment History', icon: 'history' });
    nav.push({ to: '/doctor/details', label: 'Doctor Details', icon: 'id' });
  }
  if (role === 'LAB_TECH') nav.push({ to: '/lab', label: 'Lab Panel', icon: 'flask' });
  if (role === 'ADMIN') nav.push({ to: '/admin', label: 'Admin Panel', icon: 'shield' });
  return nav;
}

function Icon({ type }) {
  const cls = 'h-4 w-4';
  if (type === 'calendar') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }
  if (type === 'wallet') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M16 13h4" />
      </svg>
    );
  }
  if (type === 'report') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
      </svg>
    );
  }
  if (type === 'stethoscope') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 3v5a4 4 0 1 0 8 0V3M8 17a4 4 0 0 0 8 0v-1a2 2 0 1 1 4 0v1" />
      </svg>
    );
  }
  if (type === 'flask') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 2v7L4 20a1 1 0 0 0 .86 1.5h14.28A1 1 0 0 0 20 20L14 9V2" />
        <path d="M8 13h8" />
      </svg>
    );
  }
  if (type === 'shield') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
      </svg>
    );
  }
  if (type === 'id') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <path d="M12 10h6M12 14h6" />
      </svg>
    );
  }
  if (type === 'history') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 3v5h5M12 7v6l4 2" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const role = user?.role;
  const nav = navForRole(role);

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-slate-900/30 transition md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close menu overlay"
      />
      <aside
        className={`fixed left-0 top-0 z-30 flex h-full w-72 transform flex-col border-r border-white/40 bg-white/80 p-4 shadow-xl backdrop-blur transition md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-8 flex items-center gap-3 px-2 pt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14967F] font-bold text-white shadow">
            H
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">HealthFlow</p>
            <p className="text-xs text-slate-500">Microservices Portal</p>
          </div>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/doctor'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#14967F]/10 text-[#14967F] ring-1 ring-[#14967F]/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon type={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-2 pt-8">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative md:ml-72">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 md:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="hidden text-sm text-slate-500 md:block">Care operations dashboard</div>
            <div className="ml-auto">
              <span className="rounded-full bg-[#14967F]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#14967F]">
                Role: {user?.role || 'GUEST'}
              </span>
            </div>
          </div>
        </header>

        <main className="health-gradient-bg mx-auto min-h-[calc(100vh-61px)] max-w-7xl rounded-t-3xl px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}


import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function RoleNav() {
  const { user, logout } = useAuth();
  const role = user?.role;

  const nav = [];
  if (role === 'PATIENT') {
    nav.push({ to: '/appointments', label: 'Appointments' });
    nav.push({ to: '/billing', label: 'Billing' });
    nav.push({ to: '/lab', label: 'Lab Reports' });
  }
  if (role === 'DOCTOR') {
    nav.push({ to: '/doctor', label: 'Doctor' });
  }
  if (role === 'LAB_TECH') {
    nav.push({ to: '/lab', label: 'Lab Queue' });
  }
  if (role === 'ADMIN') {
    nav.push({ to: '/admin', label: 'Admin' });
  }

  return (
    <div className="flex items-center gap-4">
      {nav.map((item) => (
        <Link key={item.to} to={item.to} className="text-sm text-gray-700 hover:text-gray-900">
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => logout()}
        className="text-sm rounded bg-gray-900 text-white px-3 py-1 hover:bg-gray-800"
      >
        Logout
      </button>
    </div>
  );
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-blue-600 text-white flex items-center justify-center font-bold">
              H
            </div>
            <div>
              <div className="font-semibold text-gray-900">Hospital Microservices</div>
              <div className="text-xs text-gray-500">{user ? `Role: ${user.role}` : ''}</div>
            </div>
          </div>
          <RoleNav />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}


import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role;

  const cards = [];
  if (role === 'PATIENT') {
    cards.push({ to: '/appointments', title: 'Appointments', desc: 'Book slots & upload payment slips' });
    cards.push({ to: '/billing', title: 'Billing', desc: 'Track appointment and lab bills' });
    cards.push({ to: '/lab', title: 'Lab Reports', desc: 'View confirmed lab reports' });
  }
  if (role === 'DOCTOR') {
    cards.push({ to: '/doctor', title: 'Doctor Console', desc: 'Schedules, clinical notes & lab requests' });
  }
  if (role === 'LAB_TECH') {
    cards.push({ to: '/lab', title: 'Lab Queue', desc: 'Upload reports after payment is confirmed' });
  }
  if (role === 'ADMIN') {
    cards.push({ to: '/admin', title: 'Admin Billing', desc: 'Verify payments and confirm services' });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Logged in as <span className="font-semibold">{role}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-400">
            <div className="font-semibold text-gray-900">{c.title}</div>
            <div className="text-sm text-gray-600 mt-1">{c.desc}</div>
          </Link>
        ))}
        {cards.length === 0 ? (
          <div className="text-sm text-gray-600">No dashboard cards for this role.</div>
        ) : null}
      </div>
    </div>
  );
}


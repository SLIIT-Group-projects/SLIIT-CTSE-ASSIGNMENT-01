import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, PageHero, StatCard } from '../components/ui';

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

  const stats = [
    { label: 'Appointments', value: role === 'PATIENT' ? 'Track' : 'Manage' },
    { label: 'Bills', value: role === 'PATIENT' || role === 'ADMIN' ? 'Live' : 'Monitor' },
    { label: 'Reports', value: role === 'PATIENT' || role === 'LAB_TECH' ? 'Available' : 'Overview' },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        title="Healthcare Operations Dashboard"
        subtitle={`Logged in as ${role}. Use your role-based modules to manage care workflows with confidence.`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card-surface block transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[#191919]">{c.title}</div>
                <div className="mt-1 text-sm text-[#A3A3A3]">{c.desc}</div>
              </div>
              <div className="rounded-full bg-[#FAD069] px-3 py-1 text-xs font-semibold text-[#191919]">
                Open
              </div>
            </div>
          </Link>
        ))}
        {cards.length === 0 ? (
          <EmptyState title="No dashboard modules" subtitle="No dashboard modules are available for this role." />
        ) : null}
      </div>
    </div>
  );
}


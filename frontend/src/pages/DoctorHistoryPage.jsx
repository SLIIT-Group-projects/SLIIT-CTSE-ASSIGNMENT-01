import React, { useEffect, useMemo, useState } from 'react';
import { doctorApi } from '../api/client';
import { EmptyState, LoadingState, PageHero, SurfaceCard } from '../components/ui';

export default function DoctorHistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('DESC');

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      try {
        const resp = await doctorApi.get('/doctor/history');
        if (alive) setRecords(resp.data?.records || []);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = (records || []).filter((r) => {
      if (!q) return true;
      return (
        String(r.appointmentId || '').toLowerCase().includes(q) ||
        String(r.patientId || '').toLowerCase().includes(q) ||
        String(r.patient?.name || '').toLowerCase().includes(q)
      );
    });
    out.sort((a, b) => {
      const av = new Date(a.consultedAt || 0).getTime();
      const bv = new Date(b.consultedAt || 0).getTime();
      return sortOrder === 'ASC' ? av - bv : bv - av;
    });
    return out;
  }, [records, search, sortOrder]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Appointment History"
        subtitle="View previously updated appointments and filter by patient name, patient ID, or appointment ID."
      />

      <SurfaceCard>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-xl">
            <label className="text-sm font-medium text-slate-700">
              Search
              <input
                className="input-modern"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Patient name / Patient ID / Appointment ID"
              />
            </label>
          </div>
          <div className="w-full md:w-64">
            <label className="text-sm font-medium text-slate-700">
              Sort By Date
              <select className="input-modern" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="DESC">Newest first</option>
                <option value="ASC">Oldest first</option>
              </select>
            </label>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState title="No history found" subtitle="Completed doctor updates will appear here." />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Info label="Patient Name" value={r.patient?.name || 'N/A'} />
                  <Info label="Patient ID" value={r.patientId || 'N/A'} mono />
                  <Info label="Appointment ID" value={r.appointmentId || 'N/A'} mono />
                  <Info label="Updated On" value={r.consultedAt ? new Date(r.consultedAt).toLocaleString() : 'N/A'} />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Block label="Notes" value={r.notes || '-'} />
                  <Block label="Prescription" value={r.prescription || '-'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

function Info({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm text-slate-700 ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
    </div>
  );
}

function Block({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{value}</div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { doctorApi } from '../api/client';
import { EmptyState, LoadingState, PageHero, SurfaceCard } from '../components/ui';
import { resolveLabFileUrl } from '../utils/labFileUrl';

export default function DoctorLabReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [ageFilter, setAgeFilter] = useState('ALL');

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      try {
        const resp = await doctorApi.get('/doctor/lab-reports');
        if (alive) setReports(resp.data?.labReports || []);
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
    const now = Date.now();
    const out = (reports || []).filter((r) => {
      const ts = new Date(r.uploadedAt || r.createdAt || 0).getTime();
      const ageMs = now - ts;
      if (ageFilter === 'OLDER_30' && !(ageMs > 30 * 24 * 60 * 60 * 1000)) return false;
      if (ageFilter === 'OLDER_90' && !(ageMs > 90 * 24 * 60 * 60 * 1000)) return false;
      if (ageFilter === 'LAST_30' && !(ageMs <= 30 * 24 * 60 * 60 * 1000)) return false;
      if (!q) return true;
      return (
        String(r.patient?.name || '').toLowerCase().includes(q) ||
        String(r.patientId || '').toLowerCase().includes(q) ||
        String(r.appointmentId || '').toLowerCase().includes(q) ||
        String(r.testName || '').toLowerCase().includes(q)
      );
    });
    out.sort((a, b) => {
      const av = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const bv = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return sortOrder === 'ASC' ? av - bv : bv - av;
    });
    return out;
  }, [reports, search, sortOrder, ageFilter]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Completed Lab Reports"
        subtitle="View all completed reports for your requested lab tests with patient and doctor details."
      />

      <SurfaceCard>
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
          <div className="w-full md:max-w-xl">
            <label className="text-sm font-medium text-slate-700">
              Search
              <input
                className="input-modern"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Patient name / Patient ID / Appointment ID / Test"
              />
            </label>
          </div>
          <div className="w-full md:w-64">
            <label className="text-sm font-medium text-slate-700">
              Show Reports
              <select className="input-modern" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
                <option value="ALL">All reports</option>
                <option value="LAST_30">Last 30 days</option>
                <option value="OLDER_30">Older than 30 days</option>
                <option value="OLDER_90">Older than 90 days</option>
              </select>
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
          <EmptyState title="No completed lab reports" subtitle="Completed reports for your patients will appear here." />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <details key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{r.testName || 'N/A'}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {r.patient?.name || 'N/A'} · {r.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      Details
                    </span>
                  </div>
                </summary>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Info label="Patient Name" value={r.patient?.name || 'N/A'} />
                  <Info label="Patient ID" value={r.patientId || 'N/A'} mono />
                  <Info label="Appointment ID" value={r.appointmentId || 'N/A'} mono />
                  <Info label="Doctor" value={r.doctor?.name || 'N/A'} />
                  <Info label="Doctor ID" value={r.doctorId || 'N/A'} mono />
                  <Info label="Test Name" value={r.testName || 'N/A'} />
                  <Info label="Payment Status" value={r.paymentStatus || 'N/A'} />
                  <Info label="Lab Status" value={r.labStatus || 'N/A'} />
                  <Info label="Uploaded At" value={r.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : 'N/A'} />
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-800">Report Remarks</div>
                  <div className="mt-1 text-sm text-slate-600">{r.reportRemarks || '-'}</div>
                  {r.reportUrl ? (
                    <a
                      href={resolveLabFileUrl(r.reportUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
                    >
                      Open Report File
                    </a>
                  ) : null}
                </div>
              </details>
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

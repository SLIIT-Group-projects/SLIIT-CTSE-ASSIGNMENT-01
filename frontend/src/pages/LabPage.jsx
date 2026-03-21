import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, SurfaceCard } from '../components/ui';

export default function LabPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const role = user?.role;

  const [labRequests, setLabRequests] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      if (role === 'LAB_TECH') {
        const resp = await labApi.get('/lab/requests');
        setLabRequests(resp.data.labRequests || []);
      } else {
        const resp = await labApi.get('/lab/reports');
        setLabReports(resp.data.labReports || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function uploadReport(id, file) {
    try {
      const fd = new FormData();
      fd.append('report', file);
      await labApi.post(`/lab/requests/${id}/report`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refresh();
      notify('Report uploaded.', 'success');
    } catch (_e) {
      notify('Failed to upload report.', 'error');
    }
  }

  if (role === 'LAB_TECH') {
    return (
      <div className="space-y-5">
        <PageHero
          title="Lab Panel"
          subtitle="Process incoming requests and upload reports only after payment confirmation."
        />
        <SurfaceCard>
          <h2 className="text-xl font-semibold text-slate-900">Lab Requests</h2>
          <p className="mt-1 text-sm text-slate-500">Upload lab reports only when payment is confirmed.</p>

          {loading ? (
            <div className="mt-4">
              <LoadingState />
            </div>
          ) : labRequests.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No lab requests" subtitle="New paid requests will show up here." />
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {labRequests.map((r) => (
                <div key={r._id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{r.testName}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Appointment: <span className="font-mono">{r.appointmentId}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Patient: <span className="font-mono">{r.patientId}</span>
                      </div>
                    </div>
                    <StatusBadge status={r.paymentStatus} />
                  </div>

                  <div className="mt-3 text-sm text-slate-600">
                    Notes: <span className="text-slate-800">{r.notes || '—'}</span>
                  </div>

                  <div className="mt-4">
                    {r.reportUrl ? (
                      <a className="text-sm font-semibold text-blue-700 underline" href={r.reportUrl} target="_blank" rel="noreferrer">
                        View Uploaded Report
                      </a>
                    ) : (
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={r.paymentStatus !== 'PAID'}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) await uploadReport(r._id, file);
                          }}
                          className="text-sm text-slate-600"
                        />
                        <span className="text-xs text-slate-500">
                          {r.paymentStatus !== 'PAID' ? 'Waiting for payment...' : 'Upload report now'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="Lab Reports"
        subtitle="Patient-facing reports become available when billing confirms payment."
      />
      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Lab Reports</h2>
        <p className="mt-1 text-sm text-slate-500">Reports are available after payment is confirmed.</p>

        {loading ? (
          <div className="mt-4">
            <LoadingState />
          </div>
        ) : labReports.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No reports available" subtitle="Reports appear after tests are completed and uploaded." />
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {labReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.testName}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Appointment: <span className="font-mono">{r.appointmentId}</span>
                  </div>
                </div>
                <a className="text-sm font-semibold text-blue-700 underline" href={r.reportUrl} target="_blank" rel="noreferrer">
                  View
                </a>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}


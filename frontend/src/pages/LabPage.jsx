import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function LabPage() {
  const { user } = useAuth();
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
    const fd = new FormData();
    fd.append('report', file);
    await labApi.post(`/lab/requests/${id}/report`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refresh();
  }

  if (role === 'LAB_TECH') {
    return (
      <div className="space-y-5">
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-gray-900">Lab Requests</h2>
          <p className="text-sm text-gray-600 mt-1">Upload lab reports only when payment is confirmed.</p>

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading...</div>
          ) : labRequests.length === 0 ? (
            <div className="mt-4 text-sm text-gray-600">No lab requests yet.</div>
          ) : (
            <div className="space-y-4 mt-4">
              {labRequests.map((r) => (
                <div key={r._id} className="border border-gray-100 rounded p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{r.testName}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Appointment: <span className="font-mono">{r.appointmentId}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Patient: <span className="font-mono">{r.patientId}</span>
                      </div>
                    </div>
                    <StatusBadge status={r.paymentStatus} />
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    Notes: <span className="text-gray-800">{r.notes || '—'}</span>
                  </div>

                  <div className="mt-4">
                    {r.reportUrl ? (
                      <a className="text-sm text-blue-700 underline" href={r.reportUrl} target="_blank" rel="noreferrer">
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
                        />
                        <span className="text-xs text-gray-500">
                          {r.paymentStatus !== 'PAID' ? 'Waiting for payment...' : 'Upload report now'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Lab Reports</h2>
        <p className="text-sm text-gray-600 mt-1">Reports are available after payment is confirmed.</p>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading...</div>
        ) : labReports.length === 0 ? (
          <div className="mt-4 text-sm text-gray-600">No lab reports available yet.</div>
        ) : (
          <div className="space-y-3 mt-4">
            {labReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 border border-gray-100 rounded p-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{r.testName}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Appointment: <span className="font-mono">{r.appointmentId}</span>
                  </div>
                </div>
                <a className="text-sm text-blue-700 underline" href={r.reportUrl} target="_blank" rel="noreferrer">
                  View
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


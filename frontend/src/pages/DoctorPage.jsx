import React, { useEffect, useMemo, useState } from 'react';
import { appointmentApi, doctorApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, PrimaryButton, SurfaceCard } from '../components/ui';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DoctorPage() {
  const { notify } = useToast();
  const [schedule, setSchedule] = useState(() => Array.from({ length: 7 }, () => ({ start: '', end: '' })));
  const [saving, setSaving] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  const [clinicalDrafts, setClinicalDrafts] = useState({});
  const [labDrafts, setLabDrafts] = useState({});

  async function refreshAppointments() {
    setLoadingAppts(true);
    try {
      const resp = await doctorApi.get('/doctor/appointments');
      setAppointments(resp.data.appointments || []);
    } finally {
      setLoadingAppts(false);
    }
  }

  useEffect(() => {
    refreshAppointments().catch(() => {});
  }, []);

  async function saveSchedule() {
    const slots = [];
    schedule.forEach((d, i) => {
      if (d.start && d.end) slots.push({ dayOfWeek: i, start: d.start, end: d.end });
    });
    if (slots.length === 0) {
      notify('Add at least one availability range.', 'error');
      return;
    }

    setSaving(true);
    try {
      await appointmentApi.post('/doctor/schedule', { slots });
      notify('Schedule saved.', 'success');
    } finally {
      setSaving(false);
    }
  }

  const cards = useMemo(
    () =>
      appointments.map((a) => {
        const clinical = clinicalDrafts[a._id] || { notes: '', prescription: '' };
        const lab = labDrafts[a._id] || { testName: '', notes: '' };
        return { a, clinical, lab };
      }),
    [appointments, clinicalDrafts, labDrafts]
  );

  async function submitClinical(appointmentId) {
    try {
      const draft = clinicalDrafts[appointmentId];
      await doctorApi.put(`/doctor/appointments/${appointmentId}/clinical`, {
        notes: draft?.notes || '',
        prescription: draft?.prescription || '',
      });
      setClinicalDrafts((prev) => ({ ...prev, [appointmentId]: { notes: '', prescription: '' } }));
      await refreshAppointments();
      notify('Clinical notes saved.', 'success');
    } catch (_e) {
      notify('Failed to save clinical notes.', 'error');
    }
  }

  async function submitLabRequest(appointmentId) {
    const draft = labDrafts[appointmentId];
    if (!draft?.testName) {
      notify('Enter test name.', 'error');
      return;
    }
    try {
      await doctorApi.post(`/doctor/appointments/${appointmentId}/lab-request`, {
        testName: draft.testName,
        notes: draft.notes || '',
      });
      setLabDrafts((prev) => ({ ...prev, [appointmentId]: { testName: '', notes: '' } }));
      await refreshAppointments();
      notify('Lab request submitted.', 'success');
    } catch (_e) {
      notify('Failed to submit lab request.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Doctor Panel"
        subtitle="Set weekly availability, complete clinical notes, and trigger lab requests for confirmed appointments."
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Weekly Availability</h2>
        <p className="mt-1 text-sm text-slate-500">Define weekly available time ranges. Patients can book only inside these ranges.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {dayLabels.map((label, dayIndex) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="text-sm font-semibold text-slate-800">{label}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">
                  Start
                  <input
                    className="input-modern py-2"
                    type="time"
                    value={schedule[dayIndex].start}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSchedule((prev) => prev.map((x, i) => (i === dayIndex ? { ...x, start: v } : x)));
                    }}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  End
                  <input
                    className="input-modern py-2"
                    type="time"
                    value={schedule[dayIndex].end}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSchedule((prev) => prev.map((x, i) => (i === dayIndex ? { ...x, end: v } : x)));
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <PrimaryButton
            type="button"
            onClick={saveSchedule}
            className="disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </PrimaryButton>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Confirmed Appointments</h2>
        <div className="mt-3">
          {loadingAppts ? (
            <LoadingState />
          ) : cards.length === 0 ? (
            <EmptyState title="No confirmed appointments" subtitle="Appointments will appear once billing is confirmed." />
          ) : (
            <div className="space-y-4">
              {cards.map(({ a, clinical, lab }) => (
                <div key={a._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-600">Appointment ID</div>
                      <div className="font-mono text-sm">{a._id}</div>
                      <div className="mt-1 text-sm">
                        {a.date} {a.startTime} - {a.endTime}
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-800">Notes</div>
                      <textarea
                        className="input-modern mt-0"
                        rows={3}
                        value={clinical.notes}
                        onChange={(e) => setClinicalDrafts((prev) => ({ ...prev, [a._id]: { ...clinical, notes: e.target.value } }))}
                        placeholder="Enter consultation notes"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-800">Prescription</div>
                      <textarea
                        className="input-modern mt-0"
                        rows={3}
                        value={clinical.prescription}
                        onChange={(e) => setClinicalDrafts((prev) => ({ ...prev, [a._id]: { ...clinical, prescription: e.target.value } }))}
                        placeholder="Enter prescription"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-800">Previous Reports from Patient</div>
                    {(a.previousReports || []).length === 0 ? (
                      <div className="mt-1 text-sm text-slate-500">No previous reports were added by the patient.</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {[...(a.previousReports || [])]
                          .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
                          .map((r, idx) => (
                            <div key={`${r.createdAt || idx}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                              {r.summary ? <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{r.summary}</div> : null}
                              <div className="mt-1 flex items-center justify-between gap-3">
                                <div className="text-xs text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                                {r.reportUrl ? (
                                  <a
                                    className="text-sm font-semibold text-blue-700 underline"
                                    href={r.reportUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open Report
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <PrimaryButton
                      type="button"
                      onClick={() => submitClinical(a._id)}
                    >
                      Save Notes & Prescription
                    </PrimaryButton>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="text-sm font-semibold text-slate-800">Request Lab Test</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <label className="text-sm">
                        Test Name
                        <input
                          className="input-modern"
                          value={lab.testName}
                          onChange={(e) => setLabDrafts((prev) => ({ ...prev, [a._id]: { ...lab, testName: e.target.value } }))}
                          placeholder="e.g., CBC, X-Ray"
                        />
                      </label>
                      <label className="text-sm">
                        Lab Notes (optional)
                        <input
                          className="input-modern"
                          value={lab.notes}
                          onChange={(e) => setLabDrafts((prev) => ({ ...prev, [a._id]: { ...lab, notes: e.target.value } }))}
                          placeholder="Preparation notes"
                        />
                      </label>
                    </div>
                    <PrimaryButton
                      type="button"
                      onClick={() => submitLabRequest(a._id)}
                      className="mt-3"
                    >
                      Request Lab Test
                    </PrimaryButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}


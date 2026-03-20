import React, { useEffect, useMemo, useState } from 'react';
import { appointmentApi, doctorApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DoctorPage() {
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
      alert('Add at least one availability range.');
      return;
    }

    setSaving(true);
    try {
      await appointmentApi.post('/doctor/schedule', { slots });
      alert('Schedule saved.');
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
    const draft = clinicalDrafts[appointmentId];
    await doctorApi.put(`/doctor/appointments/${appointmentId}/clinical`, {
      notes: draft?.notes || '',
      prescription: draft?.prescription || '',
    });
    setClinicalDrafts((prev) => ({ ...prev, [appointmentId]: { notes: '', prescription: '' } }));
    await refreshAppointments();
  }

  async function submitLabRequest(appointmentId) {
    const draft = labDrafts[appointmentId];
    if (!draft?.testName) {
      alert('Enter test name.');
      return;
    }
    await doctorApi.post(`/doctor/appointments/${appointmentId}/lab-request`, {
      testName: draft.testName,
      notes: draft.notes || '',
    });
    setLabDrafts((prev) => ({ ...prev, [appointmentId]: { testName: '', notes: '' } }));
    // Lab request is separate from appointment list; refresh appointments to reflect any status changes.
    await refreshAppointments();
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Weekly Availability</h2>
        <p className="text-sm text-gray-600 mt-1">Define weekly available time ranges. Patients can book only inside these ranges.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {dayLabels.map((label, dayIndex) => (
            <div key={label} className="border border-gray-100 rounded p-3">
              <div className="text-sm font-semibold text-gray-800">{label}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Start
                  <input
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1"
                    type="time"
                    value={schedule[dayIndex].start}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSchedule((prev) => prev.map((x, i) => (i === dayIndex ? { ...x, start: v } : x)));
                    }}
                  />
                </label>
                <label className="text-xs text-gray-600">
                  End
                  <input
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1"
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
          <button
            type="button"
            onClick={saveSchedule}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Confirmed Appointments</h2>
        <div className="mt-3">
          {loadingAppts ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : cards.length === 0 ? (
            <div className="text-sm text-gray-600">No confirmed appointments yet.</div>
          ) : (
            <div className="space-y-4">
              {cards.map(({ a, clinical, lab }) => (
                <div key={a._id} className="border border-gray-100 rounded p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Appointment ID</div>
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
                      <div className="text-sm font-semibold text-gray-800">Notes</div>
                      <textarea
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        rows={3}
                        value={clinical.notes}
                        onChange={(e) => setClinicalDrafts((prev) => ({ ...prev, [a._id]: { ...clinical, notes: e.target.value } }))}
                        placeholder="Enter consultation notes"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-gray-800">Prescription</div>
                      <textarea
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        rows={3}
                        value={clinical.prescription}
                        onChange={(e) => setClinicalDrafts((prev) => ({ ...prev, [a._id]: { ...clinical, prescription: e.target.value } }))}
                        placeholder="Enter prescription"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => submitClinical(a._id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Save Notes & Prescription
                    </button>
                  </div>

                  <div className="mt-5 border-t pt-4">
                    <div className="text-sm font-semibold text-gray-800">Request Lab Test</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <label className="text-sm">
                        Test Name
                        <input
                          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          value={lab.testName}
                          onChange={(e) => setLabDrafts((prev) => ({ ...prev, [a._id]: { ...lab, testName: e.target.value } }))}
                          placeholder="e.g., CBC, X-Ray"
                        />
                      </label>
                      <label className="text-sm">
                        Lab Notes (optional)
                        <input
                          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          value={lab.notes}
                          onChange={(e) => setLabDrafts((prev) => ({ ...prev, [a._id]: { ...lab, notes: e.target.value } }))}
                          placeholder="Preparation notes"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => submitLabRequest(a._id)}
                      className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Request Lab Test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


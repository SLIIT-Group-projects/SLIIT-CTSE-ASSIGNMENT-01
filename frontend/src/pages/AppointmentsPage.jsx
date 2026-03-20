import React, { useEffect, useMemo, useState } from 'react';
import { appointmentApi, billingApi, doctorApi, labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';

// NOTE: this file imports from './api' to keep imports consistent across pages.

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AppointmentsPage() {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labReports, setLabReports] = useState([]);

  const canBook = doctorId && date;

  async function refreshAll() {
    const [apptResp, prescResp, labResp] = await Promise.all([
      appointmentApi.get('/patients/appointments'),
      doctorApi.get('/doctor/clinical/patient'),
      labApi.get('/lab/reports'),
    ]);
    setAppointments(apptResp.data.appointments || []);
    setPrescriptions(prescResp.data.clinical || []);
    setLabReports(labResp.data.labReports || []);
  }

  async function loadDoctors() {
    const resp = await appointmentApi.get('/doctors');
    setDoctors(resp.data.doctors || []);
    if (!doctorId && resp.data.doctors?.[0]) setDoctorId(resp.data.doctors[0]);
  }

  async function loadSlots() {
    if (!canBook) return;
    setLoading(true);
    try {
      const resp = await appointmentApi.get(`/doctors/${doctorId}/available-slots?date=${encodeURIComponent(date)}`);
      setSlots(resp.data.slots || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSlots().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date]);

  useEffect(() => {
    refreshAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function book(slotStart) {
    const payload = { doctorId, date, slotStart };
    await appointmentApi.post('/appointments', payload);
    await refreshAll();
    await loadSlots();
  }

  async function uploadSlip(appointment, file) {
    const fd = new FormData();
    fd.append('file', file);
    await billingApi.post(`/billing/appointments/${appointment._id}/upload-slip`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refreshAll();
  }

  const groupedPrescriptions = useMemo(() => prescriptions || [], [prescriptions]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Book an Appointment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="text-sm text-gray-700">Doctor</label>
            <select className="mt-1 w-full border border-gray-300 rounded px-3 py-2" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              {doctors.length === 0 ? <option value="">No doctors yet</option> : null}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-700">Date</label>
            <input className="mt-1 w-full border border-gray-300 rounded px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => loadSlots()}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={!canBook || loading}
            >
              {loading ? 'Loading...' : 'View Available Slots'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-2">Available slots</div>
          {slots.length === 0 ? (
            <div className="text-sm text-gray-500">No slots found for selected doctor/date.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={`${s.start}-${s.end}`}
                  type="button"
                  className="px-3 py-1 rounded border border-gray-200 hover:border-gray-400 bg-white"
                  onClick={() => book(s.start)}
                >
                  {s.start} - {s.end}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Your Appointments</h2>
          <button
            type="button"
            onClick={() => refreshAll().catch(() => {})}
            className="text-sm rounded border border-gray-200 px-3 py-1 hover:border-gray-400 bg-white"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2">Date</th>
                <th className="py-2">Time</th>
                <th className="py-2">Doctor</th>
                <th className="py-2">Status</th>
                <th className="py-2">Payment Slip</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a._id} className="border-t border-gray-100">
                  <td className="py-2">{a.date}</td>
                  <td className="py-2">
                    {a.startTime} - {a.endTime}
                  </td>
                  <td className="py-2">{a.doctorId}</td>
                  <td className="py-2">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="py-2">
                    {a.status === 'PENDING_PAYMENT' ? (
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await uploadSlip(a, file);
                        }}
                        className="text-sm"
                      />
                    ) : (
                      <span className="text-sm text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-gray-500">
                    No appointments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Prescriptions</h2>
        <div className="mt-3">
          {groupedPrescriptions.length === 0 ? (
            <div className="text-sm text-gray-500">No prescriptions available yet.</div>
          ) : (
            <div className="space-y-3">
              {groupedPrescriptions.map((c) => (
                <div key={c._id} className="border border-gray-100 rounded p-3">
                  <div className="text-sm text-gray-700">
                    Appointment: <span className="font-mono">{c.appointmentId}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-semibold">Notes</div>
                    <div className="text-gray-700 whitespace-pre-wrap">{c.notes}</div>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-semibold">Prescription</div>
                    <div className="text-gray-700 whitespace-pre-wrap">{c.prescription}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Lab Reports (Quick View)</h2>
        <div className="mt-3">
          {labReports.length === 0 ? (
            <div className="text-sm text-gray-500">No lab reports available yet.</div>
          ) : (
            <div className="space-y-2">
              {labReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between border border-gray-100 rounded p-3">
                  <div className="text-sm">
                    <div className="font-semibold">{r.testName}</div>
                    <div className="text-gray-600">
                      Appointment: <span className="font-mono">{r.appointmentId}</span>
                    </div>
                  </div>
                  <a className="text-sm text-blue-700 underline" href={r.reportUrl} target="_blank" rel="noreferrer">
                    View Report
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


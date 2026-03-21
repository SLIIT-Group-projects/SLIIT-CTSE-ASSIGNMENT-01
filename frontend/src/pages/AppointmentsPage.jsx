import React, { useEffect, useMemo, useState } from 'react';
import { appointmentApi, billingApi, doctorApi, labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, PageHero, PrimaryButton, SoftButton, SurfaceCard } from '../components/ui';

// NOTE: this file imports from './api' to keep imports consistent across pages.

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AppointmentsPage() {
  const { notify } = useToast();
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
    try {
      const payload = { doctorId, date, slotStart };
      await appointmentApi.post('/appointments', payload);
      await refreshAll();
      await loadSlots();
      notify('Appointment booked successfully', 'success');
    } catch (_e) {
      notify('Failed to book appointment', 'error');
    }
  }

  async function uploadSlip(appointment, file) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      await billingApi.post(`/billing/appointments/${appointment._id}/upload-slip`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshAll();
      notify('Payment slip uploaded', 'success');
    } catch (_e) {
      notify('Could not upload payment slip', 'error');
    }
  }

  const groupedPrescriptions = useMemo(() => prescriptions || [], [prescriptions]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Appointments"
        subtitle="Book slots, upload payment slips, and track prescriptions and lab reports in one place."
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Book an Appointment</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm text-slate-700">Doctor</label>
            <select className="input-modern" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              {doctors.length === 0 ? <option value="">No doctors yet</option> : null}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-700">Date</label>
            <input className="input-modern" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <PrimaryButton
              type="button"
              onClick={() => loadSlots()}
              className="w-full disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canBook || loading}
            >
              {loading ? 'Loading...' : 'View Available Slots'}
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm text-slate-500">Available slots</div>
          {slots.length === 0 ? (
            <EmptyState title="No slots available" subtitle="No slots found for selected doctor/date." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={`${s.start}-${s.end}`}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700"
                  onClick={() => book(s.start)}
                >
                  {s.start} - {s.end}
                </button>
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Your Appointments</h2>
          <SoftButton type="button" onClick={() => refreshAll().catch(() => {})} className="px-4 py-2">
            Refresh
          </SoftButton>
        </div>
        <div className="table-shell mt-4">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Doctor</th>
                <th>Status</th>
                <th>Payment Slip</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a._id} className="table-row">
                  <td>{a.date}</td>
                  <td>
                    {a.startTime} - {a.endTime}
                  </td>
                  <td>{a.doctorId}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    {a.status === 'PENDING_PAYMENT' ? (
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await uploadSlip(a, file);
                        }}
                        className="text-sm text-slate-600"
                      />
                    ) : (
                      <span className="text-sm text-slate-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                    No appointments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Prescriptions</h2>
        <div className="mt-3">
          {groupedPrescriptions.length === 0 ? (
            <EmptyState title="No prescriptions yet" subtitle="Prescriptions will appear here after doctor updates." />
          ) : (
            <div className="space-y-3">
              {groupedPrescriptions.map((c) => (
                <div key={c._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="text-sm text-slate-600">
                    Appointment: <span className="font-mono">{c.appointmentId}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-semibold text-slate-900">Notes</div>
                    <div className="whitespace-pre-wrap text-slate-700">{c.notes}</div>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-semibold text-slate-900">Prescription</div>
                    <div className="whitespace-pre-wrap text-slate-700">{c.prescription}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Lab Reports</h2>
        <div className="mt-3">
          {labReports.length === 0 ? (
            <EmptyState title="No lab reports yet" subtitle="Reports become available after lab completion." />
          ) : (
            <div className="space-y-2">
              {labReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">{r.testName}</div>
                    <div className="text-slate-600">
                      Appointment: <span className="font-mono">{r.appointmentId}</span>
                    </div>
                  </div>
                  <a className="text-sm font-semibold text-blue-700 underline" href={r.reportUrl} target="_blank" rel="noreferrer">
                    View Report
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}


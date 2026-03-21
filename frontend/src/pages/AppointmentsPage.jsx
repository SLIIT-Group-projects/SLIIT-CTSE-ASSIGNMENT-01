import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentApi, billingApi, doctorApi, labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, PageHero, SoftButton, SurfaceCard } from '../components/ui';

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [doctorProfiles, setDoctorProfiles] = useState([]);
  const [doctorNameQuery, setDoctorNameQuery] = useState('');
  const [specialityFilter, setSpecialityFilter] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labReports, setLabReports] = useState([]);

  async function refreshAll() {
    const [apptResp, prescResp, labResp] = await Promise.all([
      appointmentApi.get('/patients/appointments'),
      doctorApi.get('/doctor/clinical/patient'),
      labApi.get('/lab/reports'),
    ]);
    const appts = apptResp.data.appointments || [];
    setAppointments(appts);
    setPrescriptions(prescResp.data.clinical || []);
    setLabReports(labResp.data.labReports || []);
    await loadDoctorProfiles([...new Set(appts.map((a) => String(a.doctorId)))]);
  }

  async function loadDoctorProfiles(doctorIds) {
    if (!doctorIds?.length) {
      return;
    }
    try {
      const resp = await doctorApi.get('/doctor/profiles', {
        params: { ids: doctorIds.join(',') },
      });
      const incoming = resp.data?.profiles || [];
      setDoctorProfiles((prev) => {
        const byId = new Map();
        [...prev, ...incoming].forEach((p) => byId.set(String(p.doctorId), p));
        return Array.from(byId.values());
      });
    } catch (_e) {
      // Keep existing profiles if fetch fails.
    }
  }

  async function loadDoctors() {
    const resp = await appointmentApi.get('/doctors');
    const ids = resp.data.doctors || [];
    setDoctors(ids);
    await loadDoctorProfiles(ids);
  }

  useEffect(() => {
    loadDoctors().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const doctorProfileMap = useMemo(() => {
    const map = new Map();
    doctorProfiles.forEach((p) => map.set(String(p.doctorId), p));
    return map;
  }, [doctorProfiles]);

  const doctorCards = useMemo(
    () =>
      doctors.map((id) => {
        const p = doctorProfileMap.get(String(id));
        return {
          doctorId: String(id),
          name: p?.name || 'Doctor profile not added',
          speciality: p?.speciality || 'Not specified',
          workingHospital: p?.workingHospital || 'Hospital not specified',
          consultationCharge: Number.isFinite(Number(p?.consultationCharge)) ? Number(p.consultationCharge) : 500,
        };
      }),
    [doctors, doctorProfileMap]
  );

  const specialityOptions = useMemo(() => {
    const values = doctorCards
      .map((d) => d.speciality)
      .filter((s) => s && s !== 'Not specified');
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [doctorCards]);

  const filteredDoctorCards = useMemo(() => {
    const q = doctorNameQuery.trim().toLowerCase();
    return doctorCards.filter((d) => {
      const byName = !q || d.name.toLowerCase().includes(q);
      const bySpeciality = !specialityFilter || d.speciality === specialityFilter;
      return byName && bySpeciality;
    });
  }, [doctorCards, doctorNameQuery, specialityFilter]);

  function openDoctorSessions(id) {
    navigate(`/appointments/doctor/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Appointments"
        subtitle="Book slots, upload payment slips, and track prescriptions and lab reports in one place."
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Choose Your Doctor</h2>
        <p className="mt-1 text-sm text-slate-500">Click a doctor profile to open upcoming sessions and confirm booking.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Search by Doctor Name
            <input
              className="input-modern"
              value={doctorNameQuery}
              onChange={(e) => setDoctorNameQuery(e.target.value)}
              placeholder="Type doctor name..."
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Filter by Speciality
            <select
              className="input-modern"
              value={specialityFilter}
              onChange={(e) => setSpecialityFilter(e.target.value)}
            >
              <option value="">All specialities</option>
              {specialityOptions.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          {filteredDoctorCards.length === 0 ? (
            <EmptyState title="No doctors found" subtitle="No available doctors were found yet." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredDoctorCards.map((d) => (
                <button
                  key={d.doctorId}
                  type="button"
                  onClick={() => openDoctorSessions(d.doctorId)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#14967F]/40 hover:bg-[#14967F]/5 hover:ring-1 hover:ring-[#14967F]/20"
                >
                  <div className="text-base font-semibold text-[#191919]">{d.name}</div>
                  <div className="mt-1 inline-flex rounded-full bg-[#FAD069]/40 px-2.5 py-1 text-xs font-semibold text-[#72560f]">
                    {d.speciality}
                  </div>
                  <div className="mt-2 text-sm text-[#A3A3A3]">{d.workingHospital}</div>
                  <div className="mt-2 text-sm font-semibold text-[#14967F]">Charge: LKR {d.consultationCharge}</div>
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
                <tr
                  key={a._id}
                  className="table-row cursor-pointer"
                  onClick={() => navigate(`/appointments/${a._id}`)}
                  title="Open appointment details"
                >
                  <td>{a.date}</td>
                  <td>
                    {a.startTime} - {a.endTime}
                  </td>
                  <td>{doctorProfileMap.get(String(a.doctorId))?.name || a.doctorId}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    {a.status === 'PENDING_PAYMENT' ? (
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={async (e) => {
                          e.stopPropagation();
                          const file = e.target.files?.[0];
                          if (file) await uploadSlip(a, file);
                        }}
                        onClick={(e) => e.stopPropagation()}
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


import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appointmentApi, doctorApi } from '../api/client';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, PrimaryButton, SoftButton, SurfaceCard } from '../components/ui';

function isoDatePlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hhmmTo12h(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

export default function AppointmentDoctorSessionsPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const upcomingDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDatePlus(i)), []);

  async function loadDoctor() {
    try {
      const resp = await doctorApi.get('/doctor/profiles', { params: { ids: doctorId } });
      setDoctor(resp.data?.profiles?.[0] || null);
    } catch (_e) {
      setDoctor(null);
    }
  }

  async function loadSessions() {
    const results = await Promise.all(
      upcomingDates.map(async (date) => {
        try {
          const resp = await appointmentApi.get(`/doctors/${doctorId}/available-slots`, { params: { date } });
          return { date, slots: resp.data?.slots || [] };
        } catch (_e) {
          return { date, slots: [] };
        }
      })
    );
    setSessions(results.filter((day) => day.slots.length > 0));
  }

  const groupedSessions = useMemo(() => {
    return sessions.map((day) => {
      const groups = [];
      for (const slot of day.slots) {
        const last = groups[groups.length - 1];
        if (!last) {
          groups.push({
            consultingStart: slot.start,
            consultingEnd: slot.end,
            firstAvailableSlotStart: slot.start,
            firstAvailableSlotEnd: slot.end,
            slots: [slot],
          });
          continue;
        }
        if (last.consultingEnd === slot.start) {
          last.consultingEnd = slot.end;
          last.slots.push(slot);
        } else {
          groups.push({
            consultingStart: slot.start,
            consultingEnd: slot.end,
            firstAvailableSlotStart: slot.start,
            firstAvailableSlotEnd: slot.end,
            slots: [slot],
          });
        }
      }
      return {
        date: day.date,
        sessions: groups,
      };
    });
  }, [sessions]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      await Promise.all([loadDoctor(), loadSessions()]);
      if (!cancelled) setLoading(false);
    }
    run().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  async function chooseSession(date, session) {
    setSelected({
      date,
      slotStart: session.firstAvailableSlotStart,
      slotEnd: session.firstAvailableSlotEnd,
      consultingStart: session.consultingStart,
      consultingEnd: session.consultingEnd,
    });
    try {
      const resp = await appointmentApi.get('/appointments/quote', {
        params: { doctorId, date, slotStart: session.firstAvailableSlotStart },
      });
      setQuote(resp.data?.quote || null);
    } catch (_e) {
      setQuote(null);
      notify('Slot is no longer available. Please choose another.', 'error');
      await loadSessions();
    }
  }

  async function confirmAppointment() {
    if (!selected) return;
    setConfirming(true);
    try {
      await appointmentApi.post('/appointments', {
        doctorId,
        date: selected.date,
        slotStart: selected.slotStart,
      });
      notify('Appointment created. Please proceed with payment.', 'success');
      navigate('/appointments');
    } catch (_e) {
      notify('Unable to confirm appointment. Try another slot.', 'error');
      await loadSessions();
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHero title="Doctor Sessions" subtitle="Loading upcoming sessions..." />
        <SurfaceCard>
          <LoadingState />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={doctor?.name ? `${doctor.name} - Sessions` : 'Doctor Sessions'}
        subtitle={
          doctor?.speciality
            ? `${doctor.speciality} | ${doctor.workingHospital || 'Hospital not specified'}${
                Number.isFinite(Number(doctor.consultationCharge))
                  ? ` | Charge: LKR ${Number(doctor.consultationCharge)}`
                  : ''
              }`
            : 'View upcoming sessions and confirm your appointment.'
        }
        action={
          <SoftButton type="button" onClick={() => navigate('/appointments')}>
            Back to Doctors
          </SoftButton>
        }
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Upcoming Sessions (Next 7 Days)</h2>
        <div className="mt-4 space-y-4">
          {groupedSessions.length === 0 ? (
            <EmptyState title="No upcoming sessions" subtitle="This doctor has no open slots in the next 7 days." />
          ) : (
            groupedSessions.map((day) => (
              <div key={day.date} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">{day.date}</div>
                <div className="flex flex-wrap gap-2">
                  {day.sessions.map((s, idx) => {
                    const active =
                      selected?.date === day.date &&
                      selected?.consultingStart === s.consultingStart &&
                      selected?.consultingEnd === s.consultingEnd;
                    return (
                      <button
                        key={`${day.date}-${s.consultingStart}-${idx}`}
                        type="button"
                        onClick={() => chooseSession(day.date, s)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          active
                            ? 'border-[#14967F]/40 bg-[#14967F]/10 text-[#14967F]'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        {s.consultingStart} - {s.consultingEnd}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Appointment Confirmation</h2>
        {!selected || !quote ? (
          <EmptyState
            title="Select a time slot"
            subtitle="Choose an available session above to preview patient number and charge."
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Selected Consulting Session</p>
              <p className="mt-1 font-semibold text-slate-900">
                {selected.date} | {selected.consultingStart || selected.slotStart} - {selected.consultingEnd || selected.slotEnd}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Patient Number</p>
              <p className="mt-1 text-2xl font-bold text-[#14967F]">#{quote.patientNumber}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Remaining Patient Count</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{quote.remainingPatientCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm text-slate-500">Appointment Charge</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {quote.currency} {quote.amount}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm text-slate-500">Estimated Screening Duration</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {quote.estimatedTimeMinutes} minutes
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Estimated wait before consultation: {quote.estimatedWaitMinutes || 0} minutes
              </p>
              {quote.estimatedAppointmentTime ? (
                <p className="mt-1 text-sm font-semibold text-[#14967F]">
                  Estimated Appointment Clock Time: {hhmmTo12h(quote.estimatedAppointmentTime)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                Queue logic: patient #1 starts at session start; next patients follow screening duration order.
              </p>
            </div>
            <div className="md:col-span-2">
              <PrimaryButton
                type="button"
                onClick={confirmAppointment}
                className="disabled:opacity-50"
                disabled={confirming}
              >
                {confirming ? 'Confirming...' : 'Confirm Appointment'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}


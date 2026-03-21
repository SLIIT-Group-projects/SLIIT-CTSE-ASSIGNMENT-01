import React, { useState } from 'react';
import { appointmentApi } from '../api/client';
import { useToast } from '../components/ToastProvider';
import { PageHero, PrimaryButton, SurfaceCard } from '../components/ui';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DoctorPage() {
  const { notify } = useToast();
  const [schedule, setSchedule] = useState(() =>
    Array.from({ length: 7 }, () => ({ start: '', end: '', plannedPatientCount: '' }))
  );
  const [saving, setSaving] = useState(false);

  async function saveSchedule() {
    const slots = [];
    schedule.forEach((d, i) => {
      if (d.start && d.end) {
        const planned = Number(d.plannedPatientCount);
        slots.push({
          dayOfWeek: i,
          start: d.start,
          end: d.end,
          ...(Number.isInteger(planned) && planned > 0 ? { plannedPatientCount: planned } : {}),
        });
      }
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

  return (
    <div className="space-y-6">
      <PageHero
        title="Doctor Availability"
        subtitle="Set weekly availability windows so patients can book only within your selected times."
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
                <label className="col-span-2 text-xs text-slate-600">
                  Planned Patients for Session
                  <input
                    className="input-modern py-2"
                    type="number"
                    min="1"
                    value={schedule[dayIndex].plannedPatientCount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSchedule((prev) => prev.map((x, i) => (i === dayIndex ? { ...x, plannedPatientCount: v } : x)));
                    }}
                    placeholder="Optional (auto-calculated from duration if empty)"
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
    </div>
  );
}


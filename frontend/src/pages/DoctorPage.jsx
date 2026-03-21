import React, { useEffect, useState } from 'react';
import { appointmentApi } from '../api/client';
import { useToast } from '../components/ToastProvider';
import { LoadingState, PageHero, PrimaryButton, SoftButton, SurfaceCard } from '../components/ui';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyWeek = () => Array.from({ length: 7 }, () => ({ start: '', end: '', plannedPatientCount: '' }));

export default function DoctorPage() {
  const { notify } = useToast();
  const [schedule, setSchedule] = useState(() => emptyWeek());
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [hasExistingSchedule, setHasExistingSchedule] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  function hydrateSchedule(slots = []) {
    const next = emptyWeek();
    slots.forEach((slot) => {
      if (!Number.isInteger(slot?.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) return;
      // Keep first slot for the day in this simple weekly editor.
      if (!next[slot.dayOfWeek].start && !next[slot.dayOfWeek].end) {
        next[slot.dayOfWeek] = {
          start: slot.start || '',
          end: slot.end || '',
          plannedPatientCount:
            Number.isInteger(slot.plannedPatientCount) && slot.plannedPatientCount > 0 ? String(slot.plannedPatientCount) : '',
        };
      }
    });
    setSchedule(next);
  }

  async function loadSchedule() {
    setLoadingSchedule(true);
    try {
      const resp = await appointmentApi.get('/doctor/schedule');
      const exists = Boolean(resp.data?.hasSchedule);
      setHasExistingSchedule(exists);
      setIsEditMode(false);
      if (exists) {
        hydrateSchedule(resp.data?.schedule?.slots || []);
      } else {
        setSchedule(emptyWeek());
      }
    } catch (_e) {
      notify('Unable to load weekly schedule right now.', 'error');
    } finally {
      setLoadingSchedule(false);
    }
  }

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (hasExistingSchedule) {
        await appointmentApi.put('/doctor/schedule', { slots });
        notify('Schedule updated.', 'success');
      } else {
        await appointmentApi.post('/doctor/schedule', { slots });
        notify('Schedule saved. You can edit it later if needed.', 'success');
      }
      setHasExistingSchedule(true);
      setIsEditMode(false);
    } catch (e) {
      if (e?.response?.status === 409) {
        notify('Weekly schedule already exists. Click edit to update it.', 'error');
        await loadSchedule();
      } else if (e?.response?.status === 404) {
        notify('No schedule found to update. Please create one first.', 'error');
        await loadSchedule();
      } else {
        notify('Unable to save schedule right now.', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  const formLocked = hasExistingSchedule && !isEditMode;

  if (loadingSchedule) {
    return (
      <div className="space-y-4">
        <PageHero title="Doctor Availability" subtitle="Loading your weekly schedule..." />
        <SurfaceCard>
          <LoadingState />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Doctor Availability"
        subtitle={
          hasExistingSchedule
            ? 'Your weekly schedule is already configured. Use edit mode to update it.'
            : 'Set your weekly availability once so patients can book only in your selected times.'
        }
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Weekly Availability</h2>
        <p className="mt-1 text-sm text-slate-500">
          {hasExistingSchedule
            ? 'Weekly schedule is saved. Click "Edit Weekly Schedule" to make changes.'
            : 'Define weekly available time ranges. Patients can book only inside these ranges.'}
        </p>

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
                    disabled={formLocked || saving}
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
                    disabled={formLocked || saving}
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
                    disabled={formLocked || saving}
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

        <div className="mt-4 flex flex-wrap gap-2">
          {hasExistingSchedule && !isEditMode ? (
            <SoftButton type="button" onClick={() => setIsEditMode(true)} disabled={saving}>
              Edit Weekly Schedule
            </SoftButton>
          ) : null}
          {isEditMode ? (
            <SoftButton type="button" onClick={loadSchedule} disabled={saving}>
              Cancel
            </SoftButton>
          ) : null}
          {!hasExistingSchedule || isEditMode ? (
            <PrimaryButton
              type="button"
              onClick={saveSchedule}
              className="disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : hasExistingSchedule ? 'Update Schedule' : 'Save Schedule'}
            </PrimaryButton>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}


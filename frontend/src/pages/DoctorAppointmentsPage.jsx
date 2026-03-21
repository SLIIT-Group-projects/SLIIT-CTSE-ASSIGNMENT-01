import React, { useEffect, useMemo, useState } from 'react';
import { doctorApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, PrimaryButton, SurfaceCard } from '../components/ui';

export default function DoctorAppointmentsPage() {
  const { notify } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [clinicalDrafts, setClinicalDrafts] = useState({});
  const [labDrafts, setLabDrafts] = useState({});
  const [medicalDrafts, setMedicalDrafts] = useState({});
  const [savingByAppointment, setSavingByAppointment] = useState({});

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

  const cards = useMemo(
    () =>
      appointments.map((a) => {
        const clinical = clinicalDrafts[a._id] || { notes: '', prescription: '' };
        const lab = labDrafts[a._id] || { mode: 'NONE', testName: '', notes: '' };
        const medical =
          medicalDrafts[a._id] || {
            age: a.patient?.medicalProfile?.age ?? '',
            heightCm: a.patient?.medicalProfile?.heightCm ?? '',
            weightKg: a.patient?.medicalProfile?.weightKg ?? '',
            bloodGroup: a.patient?.medicalProfile?.bloodGroup || 'O+',
          };
        return { a, clinical, lab, medical };
      }),
    [appointments, clinicalDrafts, labDrafts, medicalDrafts]
  );

  function getMedicalValues(appointmentId) {
    const appt = appointments.find((x) => x._id === appointmentId);
    const draft = medicalDrafts[appointmentId] || {};
    const profile = appt?.patient?.medicalProfile || {};
    return {
      age: draft.age ?? profile.age ?? '',
      heightCm: draft.heightCm ?? profile.heightCm ?? '',
      weightKg: draft.weightKg ?? profile.weightKg ?? '',
      bloodGroup: draft.bloodGroup ?? profile.bloodGroup ?? 'O+',
    };
  }

  function normalizeMedicalPayload(medical) {
    const ageRaw = String(medical.age ?? '').trim();
    const heightRaw = String(medical.heightCm ?? '').trim();
    const weightRaw = String(medical.weightKg ?? '').trim();
    const bloodRaw = String(medical.bloodGroup ?? '').trim();
    const hasAny = [ageRaw, heightRaw, weightRaw, bloodRaw].some(Boolean);
    const hasAll = [ageRaw, heightRaw, weightRaw, bloodRaw].every(Boolean);
    if (!hasAny) return { hasAny: false, hasAll: false, payload: null };
    if (!hasAll) return { hasAny: true, hasAll: false, payload: null };

    const age = Number(ageRaw);
    const heightCm = Number(heightRaw);
    const weightKg = Number(weightRaw);
    const bloodGroup = bloodRaw;
    if (!Number.isFinite(age) || age < 0 || age > 130) return { hasAny: true, hasAll: true, payload: null, error: 'Patient age must be between 0 and 130.' };
    if (!Number.isFinite(heightCm) || heightCm < 30 || heightCm > 300) return { hasAny: true, hasAll: true, payload: null, error: 'Patient height must be between 30 and 300 cm.' };
    if (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) return { hasAny: true, hasAll: true, payload: null, error: 'Patient weight must be between 1 and 500 kg.' };
    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
      return { hasAny: true, hasAll: true, payload: null, error: 'Select a valid blood group.' };
    }
    return { hasAny: true, hasAll: true, payload: { age, heightCm, weightKg, bloodGroup } };
  }

  async function updateMedicalOnly(appointmentId) {
    const appt = appointments.find((x) => x._id === appointmentId);
    if (!appt?.patientId) return notify('Patient ID not found for appointment.', 'error');

    const normalized = normalizeMedicalPayload(getMedicalValues(appointmentId));
    if (!normalized.hasAny) return notify('Enter patient medical details first.', 'error');
    if (!normalized.hasAll) return notify('Fill age, height, weight and blood group to update medical details.', 'error');
    if (normalized.error) return notify(normalized.error, 'error');

    setSavingByAppointment((prev) => ({ ...prev, [appointmentId]: true }));
    try {
      await doctorApi.put(`/doctor/patients/${appt.patientId}/medical`, normalized.payload);
      setMedicalDrafts((prev) => ({ ...prev, [appointmentId]: { ...normalized.payload } }));
      await refreshAppointments();
      notify('Patient medical details updated.', 'success');
    } catch {
      notify('Failed to update patient medical details.', 'error');
    } finally {
      setSavingByAppointment((prev) => ({ ...prev, [appointmentId]: false }));
    }
  }

  async function submitCombined(appointmentId) {
    const lab = labDrafts[appointmentId] || { mode: 'NONE', testName: '', notes: '' };
    const draft = clinicalDrafts[appointmentId];
    const mode = lab.mode || 'NONE';

    if (mode !== 'NONE' && !lab.testName?.trim()) {
      notify('Select lab option NONE or provide a lab test name.', 'error');
      return;
    }
    setSavingByAppointment((prev) => ({ ...prev, [appointmentId]: true }));
    try {
      // Step 1: always save clinical notes + prescription.
      await doctorApi.put(`/doctor/appointments/${appointmentId}/clinical`, {
        notes: draft?.notes || '',
        prescription: draft?.prescription || '',
      });

      // Step 2: optional lab request based on selected mode.
      if (mode !== 'NONE') {
        await doctorApi.post(`/doctor/appointments/${appointmentId}/lab-request`, {
          testName: lab.testName,
          notes: lab.notes || '',
        });
      }

      setClinicalDrafts((prev) => ({ ...prev, [appointmentId]: { notes: '', prescription: '' } }));
      setLabDrafts((prev) => ({ ...prev, [appointmentId]: { mode: 'NONE', testName: '', notes: '' } }));
      await refreshAppointments();
      notify(mode === 'NONE' ? 'Notes/prescription saved without lab request.' : 'Notes/prescription saved and lab request sent.', 'success');
    } catch (_e) {
      notify('Failed to submit doctor update.', 'error');
    } finally {
      setSavingByAppointment((prev) => ({ ...prev, [appointmentId]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Confirmed Appointments"
        subtitle="Attend confirmed sessions, save clinical notes, and request lab tests."
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Confirmed Appointments</h2>
        <div className="mt-3">
          {loadingAppts ? (
            <LoadingState />
          ) : cards.length === 0 ? (
            <EmptyState title="No confirmed appointments" subtitle="Appointments will appear once billing is confirmed." />
          ) : (
            <div className="space-y-4">
              {cards.map(({ a, clinical, lab, medical }) => (
                <div key={a._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-full">
                      <div className="text-sm text-slate-600">Appointment ID</div>
                      <div className="font-mono text-sm">{a._id}</div>
                      <div className="mt-1 text-sm">
                        {a.date} {a.startTime} - {a.endTime}
                      </div>

                      <div className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                            {(a.patient?.name || 'P').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{a.patient?.name || 'Unknown Patient'}</div>
                            <div className="text-xs text-slate-500">Patient details for this appointment</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Patient ID</div>
                            <div className="mt-0.5 text-sm font-mono text-slate-700 break-all">{String(a.patientId || '')}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Email</div>
                            <div className="mt-0.5 text-sm text-slate-700 break-all">{a.patient?.email || 'N/A'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Age</div>
                            <div className="mt-0.5 text-sm text-slate-700">{a.patient?.medicalProfile?.age ?? 'N/A'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Blood Group</div>
                            <div className="mt-0.5 text-sm text-slate-700">{a.patient?.medicalProfile?.bloodGroup || 'N/A'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Height (cm)</div>
                            <div className="mt-0.5 text-sm text-slate-700">{a.patient?.medicalProfile?.heightCm ?? 'N/A'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Weight (kg)</div>
                            <div className="mt-0.5 text-sm text-slate-700">{a.patient?.medicalProfile?.weightKg ?? 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-800">Update Patient Medical Details (Optional)</div>
                      <PrimaryButton
                        type="button"
                        onClick={() => updateMedicalOnly(a._id)}
                        className="disabled:opacity-50"
                        disabled={!!savingByAppointment[a._id]}
                      >
                        {savingByAppointment[a._id] ? 'Updating...' : 'Update Patient Details'}
                      </PrimaryButton>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <label className="text-sm">
                        Age
                        <input
                          className="input-modern"
                          type="number"
                          min="0"
                          max="130"
                          value={medical.age}
                          onChange={(e) => setMedicalDrafts((prev) => ({ ...prev, [a._id]: { ...medical, age: e.target.value } }))}
                        />
                      </label>
                      <label className="text-sm">
                        Height (cm)
                        <input
                          className="input-modern"
                          type="number"
                          min="30"
                          max="300"
                          value={medical.heightCm}
                          onChange={(e) => setMedicalDrafts((prev) => ({ ...prev, [a._id]: { ...medical, heightCm: e.target.value } }))}
                        />
                      </label>
                      <label className="text-sm">
                        Weight (kg)
                        <input
                          className="input-modern"
                          type="number"
                          min="1"
                          max="500"
                          value={medical.weightKg}
                          onChange={(e) => setMedicalDrafts((prev) => ({ ...prev, [a._id]: { ...medical, weightKg: e.target.value } }))}
                        />
                      </label>
                      <label className="text-sm">
                        Blood Group
                        <select
                          className="input-modern"
                          value={medical.bloodGroup || 'O+'}
                          onChange={(e) => setMedicalDrafts((prev) => ({ ...prev, [a._id]: { ...medical, bloodGroup: e.target.value } }))}
                        >
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                      </label>
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

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="text-sm font-semibold text-slate-800">Lab Request Option</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <label className="text-sm">
                        Lab Option
                        <select
                          className="input-modern"
                          value={lab.mode || 'NONE'}
                          onChange={(e) =>
                            setLabDrafts((prev) => ({
                              ...prev,
                              [a._id]: { ...lab, mode: e.target.value },
                            }))
                          }
                        >
                          <option value="NONE">None (No Lab Test)</option>
                          <option value="REQUEST">Request Lab Test</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Test Name
                        <input
                          className="input-modern"
                          value={lab.testName}
                          disabled={(lab.mode || 'NONE') === 'NONE'}
                          onChange={(e) => setLabDrafts((prev) => ({ ...prev, [a._id]: { ...lab, testName: e.target.value } }))}
                          placeholder="e.g., CBC, X-Ray"
                        />
                      </label>
                      <label className="text-sm md:col-span-2">
                        Lab Notes (optional)
                        <input
                          className="input-modern"
                          value={lab.notes}
                          disabled={(lab.mode || 'NONE') === 'NONE'}
                          onChange={(e) => setLabDrafts((prev) => ({ ...prev, [a._id]: { ...lab, notes: e.target.value } }))}
                          placeholder="Preparation notes"
                        />
                      </label>
                    </div>
                    <PrimaryButton
                      type="button"
                      onClick={() => submitCombined(a._id)}
                      className="mt-3 disabled:opacity-50"
                      disabled={!!savingByAppointment[a._id]}
                    >
                      {savingByAppointment[a._id] ? 'Submitting...' : 'Submit Doctor Update'}
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


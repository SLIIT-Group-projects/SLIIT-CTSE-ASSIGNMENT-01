import React, { useEffect, useState } from 'react';
import { doctorApi } from '../api/client';
import { useToast } from '../components/ToastProvider';
import { LoadingState, PageHero, PrimaryButton, SurfaceCard } from '../components/ui';

const initialForm = {
  name: '',
  workingHospital: '',
  speciality: '',
  bio: '',
  phone: '',
};

export default function DoctorDetailsPage() {
  const { notify } = useToast();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    setLoading(true);
    try {
      const resp = await doctorApi.get('/doctor/profile');
      const p = resp.data?.profile;
      if (p) {
        setForm({
          name: p.name || '',
          workingHospital: p.workingHospital || '',
          speciality: p.speciality || '',
          bio: p.bio || '',
          phone: p.phone || '',
        });
      }
    } catch (_e) {
      notify('Failed to load doctor details.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.workingHospital.trim() || !form.speciality.trim()) {
      notify('Name, working hospital, and speciality are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      await doctorApi.put('/doctor/profile', {
        name: form.name.trim(),
        workingHospital: form.workingHospital.trim(),
        speciality: form.speciality.trim(),
        bio: form.bio.trim(),
        phone: form.phone.trim(),
      });
      notify('Doctor details saved.', 'success');
    } catch (_e) {
      notify('Failed to save doctor details.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Doctor Details"
        subtitle="Add and maintain your professional details for the healthcare system."
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-[#191919]">Professional Profile</h2>
        <p className="mt-1 text-sm text-[#A3A3A3]">These details are stored in the doctor service database.</p>

        {loading ? (
          <div className="mt-4">
            <LoadingState />
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Name
                <input
                  className="input-modern"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Dr. Jane Doe"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Speciality
                <input
                  className="input-modern"
                  value={form.speciality}
                  onChange={(e) => setField('speciality', e.target.value)}
                  placeholder="Cardiology"
                  required
                />
              </label>
            </div>

            <label className="text-sm font-medium text-slate-700">
              Working Hospital
              <input
                className="input-modern"
                value={form.workingHospital}
                onChange={(e) => setField('workingHospital', e.target.value)}
                placeholder="City General Hospital"
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Phone (optional)
                <input
                  className="input-modern"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+94 77 123 4567"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Bio (optional)
                <textarea
                  className="input-modern min-h-[90px]"
                  value={form.bio}
                  onChange={(e) => setField('bio', e.target.value)}
                  placeholder="Short professional summary"
                />
              </label>
            </div>

            <PrimaryButton type="submit" className="disabled:opacity-50" disabled={saving}>
              {saving ? 'Saving...' : 'Save Details'}
            </PrimaryButton>
          </form>
        )}
      </SurfaceCard>
    </div>
  );
}


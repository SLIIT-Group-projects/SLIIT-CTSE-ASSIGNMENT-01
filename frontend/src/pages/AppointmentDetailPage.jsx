import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appointmentApi, billingApi, doctorApi } from '../api/client';
import { resolveAppointmentAssetUrl } from '../utils/appointmentAssets';
import { resolveBillingAssetUrl } from '../utils/billingAssets';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, PrimaryButton, SoftButton, SurfaceCard } from '../components/ui';
//import { resolveLabFileUrl } from '../utils/labFileUrl';

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [doctorName, setDoctorName] = useState('');
  const [reportFile, setReportFile] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [savingSlip, setSavingSlip] = useState(false);
  const [appointmentSlipUrl, setAppointmentSlipUrl] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const resp = await appointmentApi.get(`/appointments/${id}`);
      const a = resp.data?.appointment || null;
      setAppointment(a);
      if (a?.doctorId) {
        try {
          const doctorResp = await doctorApi.get('/doctor/profiles', { params: { ids: String(a.doctorId) } });
          setDoctorName(doctorResp.data?.profiles?.[0]?.name || String(a.doctorId));
        } catch {
          setDoctorName(String(a.doctorId));
        }
      }
      try {
        const br = await billingApi.get('/billing/patient/bills');
        const bills = br.data?.bills || [];
        const match = bills.find(
          (x) => x.billType === 'APPOINTMENT' && String(x.referenceId) === String(id)
        );
        setAppointmentSlipUrl(match?.paymentSlipUrl || null);
      } catch {
        setAppointmentSlipUrl(null);
      }
    } catch (_e) {
      notify('Failed to load appointment details.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addReportFile(e) {
    e.preventDefault();
    if (!reportFile) {
      notify('Please choose a PDF or image file.', 'error');
      return;
    }
    setSavingReport(true);
    try {
      const fd = new FormData();
      fd.append('report', reportFile);
      await appointmentApi.post(`/appointments/${id}/previous-reports/upload`, fd);
      setReportFile(null);
      await load();
      notify('Previous report uploaded.', 'success');
    } catch (e) {
      notify(e.response?.data?.message || 'Could not upload previous report.', 'error');
    } finally {
      setSavingReport(false);
    }
  }

  async function uploadBillingSlip(file) {
    if (!file) return;
    setSavingSlip(true);
    try {
      const fd = new FormData();
      fd.append('slip', file);
      await billingApi.post(`/billing/appointments/${id}/upload-slip`, fd);
      notify('Billing slip uploaded.', 'success');
      await load();
    } catch (e) {
      notify(e.response?.data?.message || 'Could not upload billing slip.', 'error');
    } finally {
      setSavingSlip(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHero title="Appointment Details" subtitle="Loading appointment data..." />
        <SurfaceCard>
          <LoadingState />
        </SurfaceCard>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <PageHero title="Appointment Details" subtitle="Unable to find this appointment." />
        <SurfaceCard>
          <EmptyState title="Appointment not found" subtitle="The appointment may have been removed." />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Appointment Details"
        subtitle={`Doctor: ${doctorName || appointment.doctorId} | Date: ${appointment.date} | Time: ${appointment.startTime} - ${appointment.endTime}`}
        action={
          <SoftButton type="button" onClick={() => navigate('/appointments')}>
            Back to Appointments
          </SoftButton>
        }
      />

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Previous Reports for Doctor Review</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload prior medical reports (PDF or image) so the doctor can review them during consultation.
        </p>

        <form className="mt-4 space-y-3" onSubmit={addReportFile}>
          <label className="block text-sm font-medium text-slate-700">
            Upload Report (PDF/Image)
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setReportFile(e.target.files?.[0] || null)}
              className="input-modern"
              required
            />
          </label>
          <PrimaryButton type="submit" className="disabled:opacity-50" disabled={savingReport}>
            {savingReport ? 'Uploading...' : 'Upload Previous Report'}
          </PrimaryButton>
        </form>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Billing Slip Upload</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload your payment slip for this appointment billing request.
        </p>
        <div className="mt-4">
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => uploadBillingSlip(e.target.files?.[0])}
            className="input-modern"
            disabled={savingSlip}
          />
          {savingSlip ? <div className="mt-2 text-sm text-slate-500">Uploading slip...</div> : null}
        </div>
        {appointmentSlipUrl ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-sm font-semibold text-slate-900">Uploaded payment slip</div>
            <p className="mt-1 text-xs text-slate-500">Preview uses the billing service URL so it loads correctly from this app.</p>
            {/\.pdf(\?|$)/i.test(resolveBillingAssetUrl(appointmentSlipUrl)) ? (
              <a
                className="mt-2 inline-block text-sm font-semibold text-teal-700 underline"
                href={resolveBillingAssetUrl(appointmentSlipUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Open PDF slip
              </a>
            ) : (
              <a
                href={resolveBillingAssetUrl(appointmentSlipUrl)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <img
                  src={resolveBillingAssetUrl(appointmentSlipUrl)}
                  alt="Your payment slip"
                  className="max-h-48 w-full object-contain"
                />
              </a>
            )}
            <a
              className="mt-2 inline-block text-xs text-slate-600 underline"
              href={resolveBillingAssetUrl(appointmentSlipUrl)}
              target="_blank"
              rel="noreferrer"
            >
              Open in new tab
            </a>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Added Previous Reports</h2>
        <div className="mt-3">
          {(appointment.previousReports || []).length === 0 ? (
            <EmptyState title="No previous reports added" subtitle="Add a report above to share with your doctor." />
          ) : (
            <div className="space-y-3">
              {[...(appointment.previousReports || [])]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((r, idx) => (
                  <div key={`${r.createdAt || idx}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="text-base font-semibold text-slate-900">{r.title}</div>
                    {r.summary ? <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{r.summary}</div> : null}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                      {r.reportUrl ? (

   

                        <a
                          className="text-sm font-semibold text-blue-700 underline"
                          href={resolveAppointmentAssetUrl(r.reportUrl)}
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
      </SurfaceCard>
    </div>
  );
}


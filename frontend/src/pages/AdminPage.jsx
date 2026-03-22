import React, { useEffect, useState, useMemo } from 'react';
import StatusBadge from '../components/StatusBadge';
import { appointmentApi, authApi, billingApi, doctorApi, labApi } from '../api/client';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, PrimaryButton, SoftButton, SurfaceCard } from '../components/ui';
import { resolveBillingAssetUrl } from '../utils/billingAssets';

function isPdfSlip(url) {
  if (!url) return false;
  return /\.pdf(\?|$)/i.test(resolveBillingAssetUrl(url));
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function formatCurrency(amount, currency = 'LKR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function AdminPage() {
  const { notify } = useToast();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRef, setBusyRef] = useState(null);
  const [rejectCandidate, setRejectCandidate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [detailBill, setDetailBill] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const [labDetail, setLabDetail] = useState(null);
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const [detailPatientName, setDetailPatientName] = useState('');
  const [detailDoctorName, setDetailDoctorName] = useState('');
  const [detailPatientEmail, setDetailPatientEmail] = useState('');
  const [namesLoading, setNamesLoading] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const resp = await billingApi.get('/billing/admin/bills');
      setBills(resp.data.bills || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function loadDetailsForBill(bill) {
    setDetailLoading(true);
    setDetailError(null);
    setAppointmentDetail(null);
    setLabDetail(null);
    setShowSlipPreview(false);
    try {
      if (bill.billType === 'APPOINTMENT') {
        const resp = await appointmentApi.get(`/appointments/${bill.referenceId}`);
        setAppointmentDetail(resp.data.appointment);
      } else {
        const resp = await labApi.get(`/lab/requests/${bill.referenceId}`);
        setLabDetail(resp.data.labRequest);
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not load related details.';
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadNamesForBill(bill) {
    setNamesLoading(true);
    setDetailPatientName('');
    setDetailDoctorName('');
    setDetailPatientEmail('');
    
    try {
      if (bill.patientName) {
        setDetailPatientName(bill.patientName);
      }
      if (bill.patientEmail) {
        setDetailPatientEmail(bill.patientEmail);
      }
      
      if (bill?.patientId && (!bill.patientName || !bill.patientEmail)) {
        try {
          const resp = await authApi.post('/auth/users/lookup', { ids: [String(bill.patientId)] });
          const u = resp.data.users?.find((x) => x.id === String(bill.patientId));
          if (u) {
            setDetailPatientName((prev) => prev || u?.name || '');
            setDetailPatientEmail((prev) => prev || u?.email || '');
          }
        } catch (authError) {
          console.warn('Could not fetch patient details from auth service:', authError);
          setDetailPatientName((prev) => prev || `Patient ${bill.patientId}`);
        }
      }
      
      if (bill?.doctorId) {
        try {
          const dr = await doctorApi.get('/doctor/profiles', { params: { ids: String(bill.doctorId) } });
          setDetailDoctorName(dr.data?.profiles?.[0]?.name || '');
        } catch (doctorError) {
          console.warn('Could not fetch doctor details:', doctorError);
          setDetailDoctorName((prev) => prev || `Doctor ${bill.doctorId}`);
        }
      }
    } catch (error) {
      console.error('Error loading names for bill:', error);
      if (bill.patientId) setDetailPatientName((prev) => prev || `Patient ${bill.patientId}`);
      if (bill.doctorId) setDetailDoctorName((prev) => prev || `Doctor ${bill.doctorId}`);
    } finally {
      setNamesLoading(false);
    }
  }

  const filteredBills = useMemo(() => {
    if (!searchTerm.trim()) return bills;
    
    const term = searchTerm.toLowerCase().trim();
    return bills.filter(bill => {
      if (bill.patientName && bill.patientName.toLowerCase().includes(term)) return true;
      if (bill.doctorName && bill.doctorName.toLowerCase().includes(term)) return true;
      if (bill.referenceId && bill.referenceId.toLowerCase().includes(term)) return true;
      if (bill.patientId && bill.patientId.toLowerCase().includes(term)) return true;
      if (bill.doctorId && bill.doctorId.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [bills, searchTerm]);

  function openDetail(bill) {
    setDetailBill(bill);
    loadDetailsForBill(bill);
    loadNamesForBill(bill);
  }

  function closeDetail() {
    setDetailBill(null);
    setDetailError(null);
    setAppointmentDetail(null);
    setLabDetail(null);
    setShowSlipPreview(false);
    setDetailPatientName('');
    setDetailDoctorName('');
    setDetailPatientEmail('');
    setNamesLoading(false);
  }

  function getBillDetailsObject() {
    if (!detailBill) return null;

    const invoiceNumber = `INV-${detailBill.referenceId}-${new Date(detailBill.createdAt).getFullYear()}`;
    
    const details = {
      invoiceNumber,
      billType: detailBill.billType,
      referenceId: detailBill.referenceId,
      patientName: detailPatientName || detailBill.patientName || '—',
      patientEmail: detailPatientEmail || detailBill.patientEmail || '—',
      patientId: detailBill.patientId,
      doctorName: detailDoctorName || detailBill.doctorName || '—',
      amount: detailBill.amount,
      currency: detailBill.currency || 'LKR',
      status: detailBill.status,
      paymentMethod: detailBill.paymentMethod || '—',
      createdAt: formatDateTime(detailBill.createdAt),
      paidAt: detailBill.paidAt ? formatDateTime(detailBill.paidAt) : '—',
    };

    if (detailBill.billType === 'APPOINTMENT' && appointmentDetail) {
      details.appointmentDate = appointmentDetail.date || '—';
      details.appointmentTime = `${appointmentDetail.startTime || '—'} - ${appointmentDetail.endTime || '—'}`;
      details.appointmentStatus = appointmentDetail.status || '—';
    }

    if (detailBill.billType === 'LAB' && labDetail) {
      details.testName = labDetail.testName || '—';
      details.labPaymentStatus = labDetail.paymentStatus || '—';
      details.labNotes = labDetail.notes || '—';
    }

    return details;
  }

  function handlePrintDetails() {
    if (!detailBill) return;
    
    const details = getBillDetailsObject();
    if (!details) return;

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      notify('Allow pop-ups to print billing details.', 'error');
      return;
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <title>Invoice ${details.invoiceNumber}</title>
    <meta charset="UTF-8">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
        background: #f8fafc;
        padding: 48px 24px;
        color: #0f172a;
      }
      
      .invoice-container {
        max-width: 800px;
        margin: 0 auto;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      
      .invoice-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: white;
        padding: 40px 48px;
        position: relative;
      }
      
      .invoice-header::after {
        content: '';
        position: absolute;
        bottom: -20px;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.05), transparent);
      }
      
      .invoice-title {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
      }
      
      .invoice-subtitle {
        font-size: 14px;
        opacity: 0.8;
        margin-top: 4px;
      }
      
      .invoice-number {
        position: absolute;
        top: 40px;
        right: 48px;
        text-align: right;
        font-family: monospace;
        font-size: 14px;
        background: rgba(255, 255, 255, 0.1);
        padding: 8px 16px;
        border-radius: 8px;
      }
      
      .invoice-number-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.7;
      }
      
      .invoice-number-value {
        font-weight: 600;
        font-size: 14px;
        margin-top: 4px;
      }
      
      .invoice-body {
        padding: 48px;
      }
      
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        margin-bottom: 40px;
        padding-bottom: 32px;
        border-bottom: 2px solid #e2e8f0;
      }
      
      .info-section {
        background: #f8fafc;
        padding: 20px;
        border-radius: 12px;
      }
      
      .info-section-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #475569;
        margin-bottom: 16px;
      }
      
      .info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        font-size: 14px;
      }
      
      .info-label {
        color: #64748b;
        font-weight: 500;
      }
      
      .info-value {
        font-weight: 600;
        color: #0f172a;
      }
      
      .details-table {
        width: 100%;
        margin: 32px 0;
        border-collapse: collapse;
      }
      
      .details-table th {
        text-align: left;
        padding: 12px 0;
        border-bottom: 2px solid #e2e8f0;
        color: #475569;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .details-table td {
        padding: 12px 0;
        border-bottom: 1px solid #e2e8f0;
        font-size: 14px;
      }
      
      .details-table tr:last-child td {
        border-bottom: none;
      }
      
      .total-section {
        background: #f1f5f9;
        padding: 24px;
        border-radius: 12px;
        margin-top: 24px;
        text-align: right;
      }
      
      .total-row {
        display: flex;
        justify-content: flex-end;
        gap: 24px;
        font-size: 18px;
        font-weight: 600;
      }
      
      .total-label {
        color: #475569;
      }
      
      .total-amount {
        color: #0f172a;
        font-size: 24px;
        font-weight: 700;
      }
      
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .status-paid {
        background: #dcfce7;
        color: #166534;
      }
      
      .status-pending {
        background: #fef9c3;
        color: #854d0e;
      }
      
      .status-pending_payment {
        background: #fef9c3;
        color: #854d0e;
      }
      
      .status-rejected {
        background: #fee2e2;
        color: #991b1b;
      }
      
      .status-verified {
        background: #dcfce7;
        color: #166534;
      }
      
      .footer {
        background: #f8fafc;
        padding: 24px 48px;
        text-align: center;
        border-top: 1px solid #e2e8f0;
        font-size: 12px;
        color: #64748b;
      }
      
      @media print {
        body {
          background: white;
          padding: 0;
        }
        .invoice-container {
          box-shadow: none;
          margin: 0;
          max-width: 100%;
        }
        .invoice-header {
          background: #0f172a;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .status-badge {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="invoice-header">
        <div class="invoice-title">Medical Bill</div>
        <div class="invoice-subtitle">${details.billType === 'APPOINTMENT' ? 'Appointment & Consultation' : 'Laboratory Services'}</div>
        <div class="invoice-number">
          <div class="invoice-number-label">Invoice Number</div>
          <div class="invoice-number-value">${escapeHtml(details.invoiceNumber)}</div>
        </div>
      </div>
      
      <div class="invoice-body">
        <div class="info-grid">
          <div class="info-section">
            <div class="info-section-title">Patient Information</div>
            <div class="info-row">
              <span class="info-label">Name</span>
              <span class="info-value">${escapeHtml(details.patientName)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">${escapeHtml(details.patientEmail)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Patient ID</span>
              <span class="info-value">${escapeHtml(details.patientId)}</span>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-section-title">Healthcare Provider</div>
            <div class="info-row">
              <span class="info-label">Doctor/Specialist</span>
              <span class="info-value">${escapeHtml(details.doctorName)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bill Date</span>
              <span class="info-value">${escapeHtml(details.createdAt)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Status</span>
              <span class="info-value">
                <span class="status-badge status-${details.status.toLowerCase().replace(/_/g, '-')}">
                  ${escapeHtml(details.status)}
                </span>
              </span>
            </div>
          </div>
        </div>
        
        <table class="details-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Details</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${details.billType === 'APPOINTMENT' ? 'Consultation Fee' : 'Laboratory Test'}</td>
              <td>
                ${details.billType === 'APPOINTMENT' 
                  ? `Appointment on ${escapeHtml(details.appointmentDate)} at ${escapeHtml(details.appointmentTime)}`
                  : `Test: ${escapeHtml(details.testName)}`
                }
              </td>
              <td>${formatCurrency(details.amount, details.currency)}</td>
            </tr>
            ${details.billType === 'APPOINTMENT' && details.appointmentStatus !== '—' ? `
            <tr>
              <td>Appointment Status</td>
              <td colspan="2">${escapeHtml(details.appointmentStatus)}</td>
            </tr>
            ` : ''}
            ${details.billType === 'LAB' && details.labNotes !== '—' ? `
            <tr>
              <td>Notes</td>
              <td colspan="2">${escapeHtml(details.labNotes)}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Total Amount</span>
            <span class="total-amount">${formatCurrency(details.amount, details.currency)}</span>
          </div>
          <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
            Payment Method: ${escapeHtml(details.paymentMethod)}
          </div>
          ${details.paidAt !== '—' ? `
          <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
            Paid on: ${escapeHtml(details.paidAt)}
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="footer">
        <p>This is a computer-generated invoice. No signature is required.</p>
        <p style="margin-top: 8px;">For any questions regarding this bill, please contact our billing department.</p>
        <p style="margin-top: 8px;">Generated on ${today}</p>
      </div>
    </div>
  </body>
</html>`;

    popup.document.write(htmlContent);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function generateEmailBody(details) {
    if (!details) return '';
    
    return `
Medical Bill Details
====================

Invoice Number: ${details.invoiceNumber}
Bill Type: ${details.billType === 'APPOINTMENT' ? 'Appointment' : 'Laboratory'}
Reference ID: ${details.referenceId}

Patient Information:
- Name: ${details.patientName}
- Email: ${details.patientEmail}
- ID: ${details.patientId}

Healthcare Provider:
- Doctor: ${details.doctorName}

Bill Details:
- Amount: ${formatCurrency(details.amount, details.currency)}
- Status: ${details.status}
- Payment Method: ${details.paymentMethod}
- Bill Date: ${details.createdAt}
${details.paidAt !== '—' ? `- Paid Date: ${details.paidAt}` : ''}

${details.billType === 'APPOINTMENT' ? `
Appointment Details:
- Date: ${details.appointmentDate}
- Time: ${details.appointmentTime}
- Status: ${details.appointmentStatus}
` : ''}

${details.billType === 'LAB' ? `
Laboratory Details:
- Test: ${details.testName}
- Payment Status: ${details.labPaymentStatus}
${details.labNotes !== '—' ? `- Notes: ${details.labNotes}` : ''}
` : ''}

Thank you for choosing our services.
    `.trim();
  }

  async function handleEmailPatient() {
    const patientEmail = detailPatientEmail || detailBill?.patientEmail;
    
    if (!patientEmail) {
      notify('Patient email is not available for this bill. Please ensure the patient has a registered email.', 'error');
      return;
    }
    
    if (!detailBill?._id) {
      notify('Bill details are not ready yet.', 'error');
      return;
    }

    setEmailBusy(true);
    try {
      await billingApi.post(`/billing/admin/bills/${detailBill._id}/email`, {
        patientEmail: patientEmail,
        patientName: detailPatientName || detailBill?.patientName,
        billData: getBillDetailsObject()
      });
      notify(`Billing details emailed to ${patientEmail}`, 'success');
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to send email.';
      if (e.response?.status === 503 || e.response?.status === 401) {
        const details = getBillDetailsObject();
        const subject = encodeURIComponent(`Medical Bill: ${details?.invoiceNumber || detailBill.referenceId}`);
        const body = encodeURIComponent(generateEmailBody(details));
        window.location.href = `mailto:${patientEmail}?subject=${subject}&body=${body}`;
        notify('Email client opened with the patient\'s email address. Please send the bill manually.', 'success');
      } else {
        notify(msg, 'error');
      }
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyBill(bill, method) {
    setBusyRef(`${bill.billType}:${bill.referenceId}`);
    try {
      if (bill.billType === 'APPOINTMENT') {
        await billingApi.put(`/billing/appointments/${bill.referenceId}/verify`, { verified: true, method });
      } else {
        await billingApi.put(`/billing/lab/${bill.referenceId}/verify`, { verified: true, method });
      }
      await refresh();
      notify('Payment verified successfully.', 'success');
      closeDetail();
    } catch (_e) {
      notify('Failed to verify payment.', 'error');
    } finally {
      setBusyRef(null);
    }
  }

  async function rejectBill(bill) {
    setBusyRef(`${bill.billType}:${bill.referenceId}`);
    try {
      if (bill.billType === 'APPOINTMENT') {
        await billingApi.put(`/billing/appointments/${bill.referenceId}/verify`, { verified: false });
      } else {
        await billingApi.put(`/billing/lab/${bill.referenceId}/verify`, { verified: false });
      }
      await refresh();
      notify('Payment rejected.', 'success');
      setRejectCandidate(null);
      closeDetail();
    } catch (_e) {
      notify('Failed to reject payment.', 'error');
    } finally {
      setBusyRef(null);
    }
  }

  const detailBusy = detailBill && busyRef === `${detailBill.billType}:${detailBill.referenceId}`;

  return (
    <div className="space-y-5">
      <PageHero
        title="Admin Panel"
        subtitle="Review payment evidence and approve or reject billing requests across services."
      />
      <SurfaceCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Verify Payments</h2>
            <p className="mt-1 text-sm text-slate-500">
              Click a bill to open details, view the payment slip, and verify or reject.
            </p>
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search by patient, doctor, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-80"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-4">
            <LoadingState />
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="mt-4">
            <EmptyState 
              title={searchTerm ? "No matching bills found" : "No bills yet"} 
              subtitle={searchTerm ? `No bills match "${searchTerm}"` : "When patients create bills, they will appear here for review."} 
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredBills.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => openDetail(b)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left transition hover:border-teal-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {b.billType === 'APPOINTMENT' ? 'Appointment' : 'Lab'} ·{' '}
                        <span className="font-mono text-xs">{b.referenceId}</span>
                      </span>
                      {b.patientName && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          👤 {b.patientName}
                        </span>
                      )}
                      {b.doctorName && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                          👨‍⚕️ {b.doctorName}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {b.amount} {b.currency || 'LKR'} · {b.paymentMethod || '—'}
                    </div>
                    {b.billType === 'APPOINTMENT' && b.appointmentDate && (
                      <div className="mt-1 text-xs text-slate-500">
                        📅 {b.appointmentDate}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-2 text-xs font-medium text-teal-700">Open details →</div>
              </button>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Styled Detail Modal */}
      {detailBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={closeDetail}
            role="presentation"
          />
          
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl transform transition-all">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {detailBill.billType === 'APPOINTMENT' ? 'Appointment Bill' : 'Laboratory Bill'}
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  Reference: <span className="font-mono">{detailBill.referenceId}</span>
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="text-slate-300 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6 space-y-6">
              {/* Patient & Doctor Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-slate-800">Patient Information</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Name:</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {namesLoading ? 'Loading...' : (detailPatientName || detailBill.patientName || '—')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Email:</span>
                      <span className="text-sm text-slate-700">
                        {namesLoading ? 'Loading...' : (detailPatientEmail || detailBill.patientEmail || '—')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Patient ID:</span>
                      <span className="text-xs font-mono text-slate-600">{detailBill.patientId}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-slate-800">Healthcare Provider</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Doctor:</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {namesLoading ? 'Loading...' : (detailDoctorName || detailBill.doctorName || '—')}
                      </span>
                    </div>
                    {detailBill.doctorId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Doctor ID:</span>
                        <span className="text-xs font-mono text-slate-600">{detailBill.doctorId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill Summary Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-slate-200 rounded-lg">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-800">Bill Summary</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(detailBill.amount, detailBill.currency || 'LKR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={detailBill.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Payment Method</p>
                    <p className="text-sm font-medium text-slate-700">{detailBill.paymentMethod || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Created</p>
                    <p className="text-sm text-slate-700">{formatDateTime(detailBill.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Related Details Section */}
              {detailLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading related details...</p>
                </div>
              ) : detailError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
                  ⚠️ {detailError}
                </div>
              ) : detailBill.billType === 'APPOINTMENT' && appointmentDetail ? (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Appointment Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="text-sm font-medium">{appointmentDetail.date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Time</p>
                      <p className="text-sm font-medium">{appointmentDetail.startTime} - {appointmentDetail.endTime}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">Status</p>
                      <div className="mt-1">
                        <StatusBadge status={appointmentDetail.status} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailBill.billType === 'LAB' && labDetail ? (
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.414 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Laboratory Details
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Test:</span>
                      <span className="text-sm font-medium">{labDetail.testName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Payment Status:</span>
                      <span className="text-sm">{labDetail.paymentStatus}</span>
                    </div>
                    {labDetail.notes && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Notes:</p>
                        <p className="text-sm text-slate-700">{labDetail.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Payment Slip Section */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Payment Slip
                </h4>
                {detailBill.paymentSlipUrl ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowSlipPreview(!showSlipPreview)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSlipPreview ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                      </svg>
                      {showSlipPreview ? 'Hide Preview' : 'View Preview'}
                    </button>
                    {showSlipPreview && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        {isPdfSlip(detailBill.paymentSlipUrl) ? (
                          <div className="text-center">
                            <p className="text-sm text-slate-600 mb-3">PDF Document</p>
                            <a
                              href={resolveBillingAssetUrl(detailBill.paymentSlipUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Open PDF
                            </a>
                          </div>
                        ) : (
                          <img
                            src={resolveBillingAssetUrl(detailBill.paymentSlipUrl)}
                            alt="Payment slip"
                            className="max-h-64 w-full object-contain rounded-lg"
                          />
                        )}
                      </div>
                    )}
                    <a
                      href={resolveBillingAssetUrl(detailBill.paymentSlipUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-slate-600 hover:text-slate-800 underline flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in new tab
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No payment slip uploaded</p>
                )}
              </div>

              {/* Print and Email Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePrintDetails}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Details
                </button>
                <button
                  onClick={handleEmailPatient}
                  disabled={emailBusy || !(detailPatientEmail || detailBill?.patientEmail)}
                  className="flex-1 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {emailBusy ? 'Sending...' : `Email ${(detailPatientEmail || detailBill?.patientEmail)?.split('@')[0] || 'Patient'}`}
                </button>
              </div>

              {/* Action Buttons for Verification - Nicely laid out with equal sizing */}
              {detailBill.status === 'PENDING_PAYMENT' ? (
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Payment Verification Actions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => verifyBill(detailBill, 'BANK_TRANSFER')}
                      disabled={detailBusy}
                      className="group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Verify Bank Transfer</span>
                    </button>
                    
                    <button
                      onClick={() => verifyBill(detailBill, 'PHYSICAL')}
                      disabled={detailBusy}
                      className="group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      <span>Approve Physical Payment</span>
                    </button>
                    
                    <button
                      onClick={() => setRejectCandidate(detailBill)}
                      disabled={detailBusy}
                      className="group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Reject Payment</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    ⚡ Select an action to verify or reject this payment
                  </p>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 text-center border border-green-200">
                  <svg className="w-6 h-6 text-green-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-800">✓ This bill has been finalized</p>
                  <p className="text-xs text-green-600 mt-1">Status: {detailBill.status}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(rejectCandidate)}
        title="Reject payment?"
        description="This action marks the bill as rejected and requires a new payment attempt."
        onClose={() => setRejectCandidate(null)}
        onConfirm={() => rejectCandidate && rejectBill(rejectCandidate)}
        confirmText="Confirm reject"
        busy={Boolean(rejectCandidate) && busyRef === `${rejectCandidate.billType}:${rejectCandidate.referenceId}`}
      />
    </div>
  );
}
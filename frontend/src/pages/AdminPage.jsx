import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { billingApi } from '../api/client';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, PrimaryButton, SurfaceCard } from '../components/ui';

export default function AdminPage() {
  const { notify } = useToast();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRef, setBusyRef] = useState(null);
  const [rejectCandidate, setRejectCandidate] = useState(null);

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
    } catch (_e) {
      notify('Failed to reject payment.', 'error');
    } finally {
      setBusyRef(null);
      setRejectCandidate(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="Admin Panel"
        subtitle="Review payment evidence and approve or reject billing requests across services."
      />
      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Verify Payments</h2>
        <p className="mt-1 text-sm text-slate-500">Verify appointment and lab payments. On approval, services are confirmed as paid.</p>

        {loading ? (
          <div className="mt-4">
            <LoadingState />
          </div>
        ) : bills.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No pending bills" subtitle="When patients upload slips, bills will appear here for review." />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {bills.map((b) => (
              <div key={b._id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {b.billType} bill for <span className="font-mono">{b.referenceId}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">Amount: {b.amount}</div>
                    <div className="mt-1 text-sm text-slate-600">Payment Method: {b.paymentMethod || '—'}</div>
                    {b.paymentSlipUrl ? (
                      <a className="text-sm font-semibold text-blue-700 underline" href={b.paymentSlipUrl} target="_blank" rel="noreferrer">
                        View slip
                      </a>
                    ) : (
                      <div className="mt-1 text-sm text-slate-500">No slip uploaded</div>
                    )}
                  </div>
                  <div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>

                {b.status === 'PENDING_PAYMENT' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <PrimaryButton
                      type="button"
                      disabled={busyRef === `${b.billType}:${b.referenceId}`}
                      onClick={() => verifyBill(b, 'BANK_TRANSFER')}
                      className="px-4 py-2 disabled:opacity-50"
                    >
                      Verify Bank Transfer
                    </PrimaryButton>
                    <PrimaryButton
                      type="button"
                      disabled={busyRef === `${b.billType}:${b.referenceId}`}
                      onClick={() => verifyBill(b, 'PHYSICAL')}
                      className="px-4 py-2 disabled:opacity-50"
                    >
                      Approve Physical Payment
                    </PrimaryButton>
                    <button
                      type="button"
                      disabled={busyRef === `${b.billType}:${b.referenceId}`}
                      onClick={() => setRejectCandidate(b)}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
      <Modal
        open={Boolean(rejectCandidate)}
        title="Reject payment?"
        description="This action marks the bill as rejected and requires a new payment attempt."
        onClose={() => setRejectCandidate(null)}
        onConfirm={() => rejectCandidate && rejectBill(rejectCandidate)}
        confirmText="Confirm Reject"
        busy={Boolean(rejectCandidate) && busyRef === `${rejectCandidate.billType}:${rejectCandidate.referenceId}`}
      />
    </div>
  );
}


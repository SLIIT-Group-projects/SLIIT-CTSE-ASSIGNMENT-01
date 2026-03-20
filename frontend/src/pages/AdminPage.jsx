import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { billingApi } from '../api/client';

export default function AdminPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRef, setBusyRef] = useState(null);

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
    } finally {
      setBusyRef(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Admin - Verify Payments</h2>
        <p className="text-sm text-gray-600 mt-1">Verify appointment and lab payments. On approval, services will be confirmed/paid.</p>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading...</div>
        ) : bills.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">No bills found.</div>
        ) : (
          <div className="mt-4 space-y-4">
            {bills.map((b) => (
              <div key={b._id} className="border border-gray-100 rounded p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {b.billType} bill for <span className="font-mono">{b.referenceId}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Amount: {b.amount}</div>
                    <div className="text-sm text-gray-600 mt-1">Payment Method: {b.paymentMethod || '—'}</div>
                    {b.paymentSlipUrl ? (
                      <a className="text-sm text-blue-700 underline" href={b.paymentSlipUrl} target="_blank" rel="noreferrer">
                        View slip
                      </a>
                    ) : (
                      <div className="text-sm text-gray-500 mt-1">No slip uploaded</div>
                    )}
                  </div>
                  <div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>

                {b.status === 'PENDING_PAYMENT' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyRef === `${b.billType}:${b.referenceId}`}
                      onClick={() => verifyBill(b, 'BANK_TRANSFER')}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Verify Bank Transfer
                    </button>
                    <button
                      type="button"
                      disabled={busyRef === `${b.billType}:${b.referenceId}`}
                      onClick={() => verifyBill(b, 'PHYSICAL')}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Approve Physical Payment
                    </button>
                    <button
                      type="button"
                      disabled={busyRef === `${b.billType}:${b.referenceId}`}
                      onClick={() => rejectBill(b)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


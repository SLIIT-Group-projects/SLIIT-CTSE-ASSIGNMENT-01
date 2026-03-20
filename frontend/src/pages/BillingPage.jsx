import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { billingApi } from '../api/client';

export default function BillingPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const resp = await billingApi.get('/billing/patient/bills');
      setBills(resp.data.bills || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900">Your Bills</h2>
        <p className="text-sm text-gray-600 mt-1">Appointment and lab payments appear here.</p>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading...</div>
        ) : bills.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">No bills yet.</div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2">Type</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Slip</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b._id} className="border-t border-gray-100">
                    <td className="py-2">{b.billType}</td>
                    <td className="py-2 font-mono">{b.referenceId}</td>
                    <td className="py-2">{b.amount}</td>
                    <td className="py-2">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-2">
                      {b.paymentSlipUrl ? (
                        <a className="text-sm text-blue-700 underline" href={b.paymentSlipUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


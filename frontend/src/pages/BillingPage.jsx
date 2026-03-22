import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { billingApi } from '../api/client';
import { resolveBillingAssetUrl } from '../utils/billingAssets';
import { EmptyState, LoadingState, PageHero, SurfaceCard } from '../components/ui';

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
      <PageHero title="Billing" subtitle="Track appointment and lab payments in one clean view." />
      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Your Bills</h2>
        <p className="mt-1 text-sm text-slate-500">Appointment and lab payments appear here.</p>

        {loading ? (
          <div className="mt-4">
            <LoadingState />
          </div>
        ) : bills.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No bills yet" subtitle="Appointment and lab bills will appear here." />
          </div>
        ) : (
          <div className="table-shell mt-4">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Slip</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b._id} className="table-row">
                    <td>{b.billType}</td>
                    <td className="font-mono">{b.referenceId}</td>
                    <td>{b.amount}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      {b.paymentSlipUrl ? (
                        <a
                          className="text-sm font-semibold text-blue-700 underline"
                          href={resolveBillingAssetUrl(b.paymentSlipUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}


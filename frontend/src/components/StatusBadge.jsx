import React from 'react';

const stylesByStatus = {
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  PAID: 'bg-blue-100 text-blue-800 border-blue-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
};

export default function StatusBadge({ status }) {
  const cls = stylesByStatus[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}


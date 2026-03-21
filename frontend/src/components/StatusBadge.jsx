import React from 'react';

const stylesByStatus = {
  PENDING_PAYMENT: 'bg-[#FAD069]/35 text-[#8A6700] border-[#FAD069]/80',
  CONFIRMED: 'bg-[#14967F]/15 text-[#14967F] border-[#14967F]/35',
  COMPLETED: 'bg-[#14967F]/15 text-[#14967F] border-[#14967F]/35',
  PAID: 'bg-blue-100 text-blue-800 border-blue-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

export default function StatusBadge({ status }) {
  const cls = stylesByStatus[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}


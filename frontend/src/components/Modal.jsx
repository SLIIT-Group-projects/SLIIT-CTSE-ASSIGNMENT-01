import React from 'react';
import { PrimaryButton, SoftButton } from './ui';

export default function Modal({ open, title, description, onClose, onConfirm, confirmText = 'Confirm', busy = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} role="button" tabIndex={-1} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
        <h3 className="text-xl font-semibold text-[#191919]">{title}</h3>
        {description ? <p className="mt-2 text-sm text-[#A3A3A3]">{description}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <SoftButton onClick={onClose} className="px-4 py-2">
            Cancel
          </SoftButton>
          <PrimaryButton onClick={onConfirm} className="px-4 py-2 disabled:opacity-50" disabled={busy}>
            {busy ? 'Working...' : confirmText}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}


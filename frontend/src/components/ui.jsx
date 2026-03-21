import React from 'react';

function join(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function PageHero({ title, subtitle, action, className = '' }) {
  return (
    <section
      className={join(
        'animate-fade-in relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#14967F]/95 via-[#14967F]/90 to-[#2e7de3] p-6 text-white shadow-lg md:p-8',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-20 h-24 w-24 rounded-full bg-[#FAD069]/30 blur-2xl" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide text-white/95">
            Healthcare Management
          </span>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-white/90 md:text-base">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </section>
  );
}

export function SurfaceCard({ children, className = '' }) {
  return <section className={join('card-surface animate-fade-in', className)}>{children}</section>;
}

export function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function PrimaryButton({ className = '', children, ...props }) {
  return (
    <button className={join('btn-primary', className)} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({ className = '', children, ...props }) {
  return (
    <button className={join('btn-secondary', className)} {...props}>
      {children}
    </button>
  );
}

export function SoftButton({ className = '', children, ...props }) {
  return (
    <button className={join('btn-soft', className)} {...props}>
      {children}
    </button>
  );
}

export function LoadingState({ text = 'Loading...' }) {
  return <div className="text-sm text-[#A3A3A3]">{text}</div>;
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 text-center">
      <p className="text-base font-semibold text-[#191919]">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-[#A3A3A3]">{subtitle}</p> : null}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <SurfaceCard className="p-5">
      <p className="text-sm text-[#A3A3A3]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#191919]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#A3A3A3]">{hint}</p> : null}
    </SurfaceCard>
  );
}


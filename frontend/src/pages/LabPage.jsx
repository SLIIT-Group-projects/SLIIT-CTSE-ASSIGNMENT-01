import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, SurfaceCard } from '../components/ui';
import { resolveLabFileUrl } from '../utils/labFileUrl';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/*,application/pdf';

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function shortId(id) {
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function validateLabFile(file) {
  const okType = file.type === 'application/pdf' || file.type.startsWith('image/');
  if (!okType) return 'Only PDF or image files are allowed.';
  if (file.size > MAX_BYTES) return `File too large (max ${formatBytes(MAX_BYTES)}).`;
  return null;
}

function buildRequestsQuery({ search, paymentStatus }) {
  const q = new URLSearchParams();
  if (search.trim()) q.set('search', search.trim());
  if (paymentStatus && paymentStatus !== 'all') q.set('paymentStatus', paymentStatus);
  const s = q.toString();
  return s ? `?${s}` : '';
}

function partitionLabQueues(requests) {
  const active = [];
  const completed = [];
  for (const r of requests) {
    if (r.reportUrl) completed.push(r);
    else active.push(r);
  }
  completed.sort((a, b) => {
    const ta = new Date(a.uploadedAt || a.createdAt).getTime();
    const tb = new Date(b.uploadedAt || b.createdAt).getTime();
    return tb - ta;
  });
  return { activeQueue: active, completedQueue: completed };
}

export default function LabPage() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { notify } = useToast();
  const role = user?.role;
  const labTechCompletedOnly = role === 'LAB_TECH' && pathname === '/lab/completed';

  const [labRequests, setLabRequests] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');

  const [remarksById, setRemarksById] = useState({});
  const [dragOverId, setDragOverId] = useState(null);
  const [pendingFileById, setPendingFileById] = useState({});
  const [fileErrorById, setFileErrorById] = useState({});
  /** Completed page: which rows show full details (key = request id string) */
  const [expandedCompleted, setExpandedCompleted] = useState({});

  const queryString = useMemo(() => buildRequestsQuery({ search, paymentStatus }), [search, paymentStatus]);

  const { activeQueue, completedQueue } = useMemo(() => partitionLabQueues(labRequests), [labRequests]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (role === 'LAB_TECH') {
        const resp = await labApi.get(`/lab/requests${queryString}`);
        setLabRequests(resp.data.labRequests || []);
      } else {
        const resp = await labApi.get('/lab/reports');
        setLabReports(resp.data.labReports || []);
      }
    } finally {
      setLoading(false);
    }
  }, [role, queryString]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  async function setLabStatus(id, status) {
    try {
      await labApi.put(`/lab/requests/${id}/status`, { status });
      await refresh();
      notify(status === 'IN_PROGRESS' ? 'Marked as in progress.' : 'Returned to queue.', 'success');
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not update status.';
      notify(msg, 'error');
    }
  }

  async function setPriority(id, priority) {
    try {
      await labApi.patch(`/lab/requests/${id}`, { priority });
      await refresh();
      notify(`Priority set to ${priority}.`, 'success');
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not update priority.';
      notify(msg, 'error');
    }
  }

  async function uploadReport(id, file) {
    const err = validateLabFile(file);
    if (err) {
      setFileErrorById((prev) => ({ ...prev, [id]: err }));
      notify(err, 'error');
      return;
    }
    setFileErrorById((prev) => ({ ...prev, [id]: null }));
    try {
      const fd = new FormData();
      fd.append('report', file);
      fd.append('remarks', remarksById[id] ?? '');
      await labApi.post(`/lab/requests/${id}/report`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPendingFileById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refresh();
      notify('Report uploaded. Patient notification flag set (email in production).', 'success');
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to upload report.';
      notify(msg, 'error');
    }
  }

  function onFileChosen(id, fileList) {
    const file = fileList?.[0];
    if (!file) return;
    const err = validateLabFile(file);
    setFileErrorById((prev) => ({ ...prev, [id]: err }));
    if (err) {
      notify(err, 'error');
      return;
    }
    setPendingFileById((prev) => ({ ...prev, [id]: file }));
  }

  function handleDrop(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileChosen(id, [file]);
  }

  function toggleCompletedExpanded(requestId) {
    const key = String(requestId);
    setExpandedCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderLabRequestBody(r) {
    const id = r._id;
    const labStatus = r.labStatus || 'QUEUED';
    const priority = r.priority || 'NORMAL';
    const paid = r.paymentStatus === 'PAID';
    const hasFile = Boolean(r.reportUrl);
    const canStart = paid && !hasFile && labStatus === 'QUEUED';
    const canResetQueue = paid && !hasFile && labStatus === 'IN_PROGRESS';
    const canUploadNew = paid && labStatus === 'IN_PROGRESS' && !hasFile;
    const canReplace = paid && hasFile && labStatus === 'COMPLETED';
    const pending = pendingFileById[id];
    const fileErr = fileErrorById[id];

    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800">{r.testName}</div>
            <div className="mt-1 text-xs text-slate-500">Requested {formatDate(r.createdAt)}</div>
            <div className="mt-1 text-sm text-slate-600">
              Appointment: <span className="font-mono text-xs">{String(r.appointmentId)}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Patient: <span className="font-mono text-xs">{String(r.patientId)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.paymentStatus} />
            <StatusBadge status={labStatus} />
            <StatusBadge status={priority} />
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-600">
          Doctor notes: <span className="text-slate-800">{r.notes || '—'}</span>
        </div>

        {(r.uploadedAt || r.replacedAt) && (
          <div className="mt-2 text-xs text-slate-500 space-y-0.5">
            {r.uploadedAt && (
              <div>
                Uploaded: {formatDate(r.uploadedAt)}
                {r.uploadedBy ? <span className="ml-1 font-mono">by {String(r.uploadedBy)}</span> : null}
              </div>
            )}
            {r.replacedAt && <div>Last replaced: {formatDate(r.replacedAt)}</div>}
            {r.patientNotified && <div className="text-emerald-700">Patient notify flag set (stub — wire email in production)</div>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canStart}
            onClick={() => setLabStatus(id, 'IN_PROGRESS')}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Start processing
          </button>
          <button
            type="button"
            disabled={!canResetQueue}
            onClick={() => setLabStatus(id, 'QUEUED')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back to queue
          </button>
          <button
            type="button"
            onClick={() => setPriority(id, priority === 'URGENT' ? 'NORMAL' : 'URGENT')}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900"
          >
            {priority === 'URGENT' ? 'Mark normal' : 'Mark urgent'}
          </button>
        </div>

        <div className="mt-4">
          {hasFile ? (
            <div className="space-y-2">
              <a className="text-sm font-semibold text-blue-700 underline" href={resolveLabFileUrl(r.reportUrl)} target="_blank" rel="noreferrer">
                View uploaded report
              </a>
              {r.reportRemarks ? (
                <div className="text-sm text-slate-600">
                  Remarks: <span className="text-slate-800">{r.reportRemarks}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {(canUploadNew || canReplace) && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-slate-600">Optional remarks (max 500 chars)</label>
              <textarea
                value={remarksById[id] ?? ''}
                onChange={(e) => setRemarksById((prev) => ({ ...prev, [id]: e.target.value.slice(0, 500) }))}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400"
                placeholder="e.g. fasting glucose — within range"
              />
              <div
                role="presentation"
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverId(id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(id);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null);
                }}
                onDrop={(e) => handleDrop(e, id)}
                className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  dragOverId === id ? 'border-blue-500 bg-blue-50/80' : 'border-slate-200 bg-white/80'
                }`}
              >
                <p className="text-sm font-medium text-slate-700">
                  {canReplace ? 'Drop a new file to replace the report' : 'Drop PDF or image here, or choose a file'}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatBytes(MAX_BYTES)} max · PDF or images</p>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="mt-3 block w-full max-w-xs mx-auto text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  onChange={(e) => onFileChosen(id, e.target.files)}
                />
              </div>
              {pending && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-slate-700">
                    Selected: <span className="font-medium">{pending.name}</span> ({formatBytes(pending.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => uploadReport(id, pending)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {canReplace ? 'Replace report' : 'Upload report'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFileById((prev) => {
                        const n = { ...prev };
                        delete n[id];
                        return n;
                      })
                    }
                    className="text-xs text-slate-500 underline"
                  >
                    Clear
                  </button>
                </div>
              )}
              {fileErr && <p className="text-sm text-red-600">{fileErr}</p>}
            </div>
          )}

          {!paid && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Waiting for payment before you can start processing.
            </p>
          )}
          {paid && !hasFile && labStatus === 'QUEUED' && (
            <p className="mt-3 text-xs text-slate-600">Click &quot;Start processing&quot; before uploading.</p>
          )}
        </div>
      </>
    );
  }

  function renderLabRequestCard(r) {
    const id = r._id;
    return (
      <div key={id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
        {renderLabRequestBody(r)}
      </div>
    );
  }

  function renderCompletedCollapsibleRow(r) {
    const id = r._id;
    const key = String(id);
    const expanded = Boolean(expandedCompleted[key]);
    const priority = r.priority || 'NORMAL';

    return (
      <div className="rounded-2xl border border-emerald-100/80 bg-white p-3 shadow-sm">
        <div className="flex items-start gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => toggleCompletedExpanded(id)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg
              className={`h-5 w-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{r.testName}</span>
              <StatusBadge status={priority} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>
                Patient <span className="font-mono text-slate-800">{shortId(r.patientId)}</span>
              </span>
              <span>Uploaded {formatDate(r.uploadedAt)}</span>
            </div>
            {r.reportRemarks ? (
              <p className="mt-1 truncate text-xs text-slate-500" title={r.reportRemarks}>
                Remark: <span className="text-slate-700">{r.reportRemarks}</span>
              </p>
            ) : null}
          </div>
          <a
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            href={resolveLabFileUrl(r.reportUrl)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            View report
          </a>
        </div>

        {expanded ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">{renderLabRequestBody(r)}</div>
          </div>
        ) : null}
      </div>
    );
  }

  if (role === 'LAB_TECH') {
    const filtersCard = (
      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Filters</h2>
        <p className="mt-1 text-sm text-slate-500">
          Payment must be <strong>PAID</strong> before processing. Upload requires <strong>In progress</strong> first. Use the sidebar to switch
          between the work queue and completed reports.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Test name or patient ID"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 min-w-[200px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Payment</span>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400"
            >
              <option value="all">All</option>
              <option value="PAID">Paid only</option>
              <option value="PENDING_PAYMENT">Pending payment</option>
            </select>
          </label>
        </div>
      </SurfaceCard>
    );

    return (
      <div className="space-y-5">
        <PageHero
          title={labTechCompletedOnly ? 'Completed lab reports' : 'Lab queue'}
          subtitle={
            labTechCompletedOnly
              ? 'Each row shows a short summary. Expand with the chevron for full details and replace upload.'
              : 'Requests waiting for a report. After you upload, they appear under Completed reports in the sidebar.'
          }
        />
        {filtersCard}

        {loading ? (
          <SurfaceCard>
            <LoadingState />
          </SurfaceCard>
        ) : labRequests.length === 0 ? (
          <SurfaceCard>
            <EmptyState title="No lab requests" subtitle="Adjust filters or wait for new requests." />
          </SurfaceCard>
        ) : labTechCompletedOnly ? (
          <SurfaceCard className="border-l-4 border-l-emerald-500">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Completed reports</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Summary per row; use the chevron to expand full details, actions, and replace upload.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">{completedQueue.length} done</span>
            </div>
            <div className="mt-4 space-y-3">
              {completedQueue.length === 0 ? (
                <EmptyState title="No completed reports yet" subtitle="Upload a report from the Lab queue page; finished work will list here." />
              ) : (
                completedQueue.map((r) => (
                  <React.Fragment key={r._id}>{renderCompletedCollapsibleRow(r)}</React.Fragment>
                ))
              )}
            </div>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="border-l-4 border-l-amber-400">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Work queue</h2>
                <p className="mt-1 text-sm text-slate-500">No report uploaded yet — start processing and upload here.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{activeQueue.length} open</span>
            </div>
            <div className="mt-4 space-y-4">
              {activeQueue.length === 0 ? (
                <EmptyState title="Queue is clear" subtitle="No pending requests match your filters, or open Completed reports to see finished work." />
              ) : (
                activeQueue.map((r) => renderLabRequestCard(r))
              )}
            </div>
          </SurfaceCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="Lab Reports"
        subtitle="Patient-facing reports become available when billing confirms payment."
      />
      <SurfaceCard>
        <h2 className="text-xl font-semibold text-slate-900">Lab Reports</h2>
        <p className="mt-1 text-sm text-slate-500">Reports are available after payment is confirmed.</p>

        {loading ? (
          <div className="mt-4">
            <LoadingState />
          </div>
        ) : labReports.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No reports available" subtitle="Reports appear after tests are completed and uploaded." />
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {labReports.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.testName}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Appointment: <span className="font-mono">{r.appointmentId}</span>
                  </div>
                  {r.reportRemarks ? (
                    <div className="mt-1 text-xs text-slate-600">
                      Lab remarks: <span className="text-slate-800">{r.reportRemarks}</span>
                    </div>
                  ) : null}
                  {r.uploadedAt && (
                    <div className="mt-1 text-xs text-slate-500">Uploaded {formatDate(r.uploadedAt)}</div>
                  )}
                </div>
                <a className="text-sm font-semibold text-blue-700 underline shrink-0" href={resolveLabFileUrl(r.reportUrl)} target="_blank" rel="noreferrer">
                  View report
                </a>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

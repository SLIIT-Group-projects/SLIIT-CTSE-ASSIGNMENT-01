import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { labApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { EmptyState, LoadingState, PageHero, StatCard, SurfaceCard } from '../components/ui';
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

function buildRequestsQuery({ search, labStatus, priority, sort }) {
  const q = new URLSearchParams();
  if (search.trim()) q.set('search', search.trim());
  if (labStatus && labStatus !== 'all') q.set('labStatus', labStatus);
  if (priority && priority !== 'all') q.set('priority', priority);
  if (sort && sort !== 'newest') q.set('sort', sort);
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
  /** Global lab stats (GET /lab/dashboard/summary) — not tied to list filters */
  const [labSummary, setLabSummary] = useState(null);

  const [search, setSearch] = useState('');
  const [labStatusFilter, setLabStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  /** newest first (default) or oldest first */
  const [sortOrder, setSortOrder] = useState('newest');

  const [remarksById, setRemarksById] = useState({});
  const [dragOverId, setDragOverId] = useState(null);
  const [pendingFileById, setPendingFileById] = useState({});
  const [fileErrorById, setFileErrorById] = useState({});
  /** Completed page: which rows show full details (key = request id string) */
  const [expandedCompleted, setExpandedCompleted] = useState({});
  const [notifyBusyId, setNotifyBusyId] = useState(null);

  const queryString = useMemo(
    () => buildRequestsQuery({ search, labStatus: labStatusFilter, priority: priorityFilter, sort: sortOrder }),
    [search, labStatusFilter, priorityFilter, sortOrder]
  );

  useEffect(() => {
    if (role !== 'LAB_TECH') return;
    if (pathname === '/lab/completed') setLabStatusFilter('COMPLETED');
    else if (pathname === '/lab') setLabStatusFilter('all');
  }, [pathname, role]);

  const { activeQueue, completedQueue } = useMemo(() => partitionLabQueues(labRequests), [labRequests]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (role === 'LAB_TECH') {
        const [reqResp, sumResp] = await Promise.all([
          labApi.get(`/lab/requests${queryString}`),
          labApi.get('/lab/dashboard/summary'),
        ]);
        setLabRequests(reqResp.data.labRequests || []);
        setLabSummary(sumResp.data || null);
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

  async function notifyPatientByEmail(id) {
    setNotifyBusyId(id);
    try {
      const resp = await labApi.post(`/lab/requests/${id}/notify-email`);
      await refresh();
      const devMode = resp.data?.mail?.devMode;
      notify(
        devMode ? 'Notification simulated (check server logs). Add SMTP_* in lab-service .env to send real email.' : 'Email sent to the patient.',
        'success'
      );
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not send email.';
      notify(msg, 'error');
    } finally {
      setNotifyBusyId(null);
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
              Patient:{' '}
              {r.patientName ? (
                <>
                  <span className="font-medium text-slate-800">{r.patientName}</span>
                  <span className="font-mono text-xs text-slate-500"> · {String(r.patientId)}</span>
                </>
              ) : (
                <span className="font-mono text-xs">{String(r.patientId)}</span>
              )}
            </div>
            {r.patientEmail ? (
              <div className="mt-1 text-xs text-slate-500">
                Email: <span className="text-slate-700">{r.patientEmail}</span>
              </div>
            ) : null}
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
            {r.emailNotifiedAt && <div className="text-emerald-700">Patient emailed: {formatDate(r.emailNotifiedAt)}</div>}
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
              <div className="flex flex-wrap items-center gap-3">
                <a className="text-sm font-semibold text-blue-700 underline" href={resolveLabFileUrl(r.reportUrl)} target="_blank" rel="noreferrer">
                  View uploaded report
                </a>
                {labStatus === 'COMPLETED' && r.patientEmail ? (
                  <button
                    type="button"
                    disabled={notifyBusyId === id || Boolean(r.emailNotifiedAt)}
                    title={r.emailNotifiedAt ? 'Already notified' : 'Send report link by email'}
                    onClick={() => notifyPatientByEmail(id)}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {notifyBusyId === id ? 'Sending…' : r.emailNotifiedAt ? 'Emailed patient' : 'Email patient'}
                  </button>
                ) : labStatus === 'COMPLETED' && !r.patientEmail ? (
                  <span className="text-xs text-amber-700">Patient email unavailable (auth lookup)</span>
                ) : null}
              </div>
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
                Patient{' '}
                {r.patientName ? (
                  <>
                    <span className="font-semibold text-slate-900">{r.patientName}</span>
                    <span className="font-mono text-slate-500"> · {shortId(r.patientId)}</span>
                  </>
                ) : (
                  <span className="font-mono text-slate-800">{shortId(r.patientId)}</span>
                )}
              </span>
              <span>Uploaded {formatDate(r.uploadedAt)}</span>
            </div>
            {r.reportRemarks ? (
              <p className="mt-1 truncate text-xs text-slate-500" title={r.reportRemarks}>
                Remark: <span className="text-slate-700">{r.reportRemarks}</span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <a
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              href={resolveLabFileUrl(r.reportUrl)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              View report
            </a>
            {r.patientEmail ? (
              <button
                type="button"
                disabled={notifyBusyId === id || Boolean(r.emailNotifiedAt)}
                onClick={(e) => {
                  e.stopPropagation();
                  notifyPatientByEmail(id);
                }}
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {notifyBusyId === id ? 'Sending…' : r.emailNotifiedAt ? 'Emailed' : 'Email patient'}
              </button>
            ) : (
              <span className="max-w-[8rem] text-right text-[10px] text-amber-700">No patient email</span>
            )}
            {r.emailNotifiedAt ? (
              <span className="text-[10px] text-slate-500">{formatDate(r.emailNotifiedAt)}</span>
            ) : null}
          </div>
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
          Filter by <strong>lab workflow status</strong> and <strong>priority</strong>. Sort by request date. Search matches test name, patient ID, or
          patient name (2+ letters for name lookup).
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Test name, patient name, or patient ID"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 min-w-[200px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Lab status</span>
            <select
              value={labStatusFilter}
              onChange={(e) => setLabStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 min-w-[180px]"
            >
              <option value="all">All</option>
              <option value="QUEUED">Queued</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Priority</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 min-w-[150px]"
            >
              <option value="all">All</option>
              <option value="URGENT">Urgent only</option>
              <option value="NORMAL">Normal only</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Sort</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 min-w-[150px]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </SurfaceCard>
    );

    const sum = labSummary || {};
    const stat = (n) => (n == null || Number.isNaN(n) ? '—' : String(n));

    const labDashboardSection = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Open (no report)"
            value={stat(sum.openWorkQueue)}
            hint={sum.oldestOpenHours != null ? `Oldest open ≈ ${sum.oldestOpenHours}h` : 'Work queue'}
          />
          <StatCard label="Completed (7 days)" value={stat(sum.completedThisWeek)} hint="Reports uploaded in the last week" />
          <StatCard label="Urgent (open)" value={stat(sum.urgentOpen)} hint="URGENT & no report yet" />
          <StatCard label="Payment pending" value={stat(sum.pendingPayment)} hint="Awaiting patient payment" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SurfaceCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900">Quick links</h3>
            <p className="mt-1 text-xs text-slate-500">Jump to lab views.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/lab"
                className="inline-flex rounded-full border border-[#14967F]/30 bg-[#14967F]/10 px-3 py-1.5 text-xs font-semibold text-[#14967F] hover:bg-[#14967F]/15"
              >
                Lab queue
              </Link>
              <Link
                to="/lab/completed"
                className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Completed reports
              </Link>
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900">Workflow</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
              <li>Payment must be confirmed (billing).</li>
              <li>Start processing → upload PDF or image.</li>
              <li>Email patient when ready (optional).</li>
            </ol>
          </SurfaceCard>
          <SurfaceCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900">Accepted uploads</h3>
            <p className="mt-2 text-xs text-slate-600">
              <strong>PDF</strong> or <strong>images</strong> (JPEG, PNG, etc.). Max <strong>{formatBytes(MAX_BYTES)}</strong> per file.
            </p>
            <p className="mt-2 text-xs text-slate-500">Use lab status, priority, and sort to narrow the list.</p>
          </SurfaceCard>
        </div>
      </>
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
        {labDashboardSection}
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

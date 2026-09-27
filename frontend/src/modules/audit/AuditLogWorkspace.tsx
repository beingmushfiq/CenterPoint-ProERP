import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import { ShieldAlert, Search, Filter, Eye, User, CheckCircle2, FileCode } from 'lucide-react';
import type { AuditLogItem } from '../../types/api/audit';
import { SelectDropdown } from '../../components/ui/Dropdown';

export const AuditLogWorkspace: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data: auditLogs = [], isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ['audit-logs', selectedAction],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (selectedAction !== 'all') params.set('action', selectedAction);
        const res = await api.get<any>(`/audit-logs?${params.toString()}`);
        return extractList<AuditLogItem>(res);
      } catch {
        return [];
      }
    },
  });

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.auditable_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(log.auditable_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.correlation_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = selectedAction === 'all' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'updated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'deleted':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'posted':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'voided':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-indigo-600" />
            System Audit Trail & Compliance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable tenant-scoped audit logging with complete before/after state diffs, actor
            attribution, and request correlation IDs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Append-Only Guarantee Active
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by entity, ID, user, correlation ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>

          <SelectDropdown
            icon={Filter}
            options={[
              { value: 'all', label: 'All Actions' },
              { value: 'created', label: 'Created', colorDot: 'bg-emerald-500' },
              { value: 'updated', label: 'Updated', colorDot: 'bg-blue-500' },
              { value: 'deleted', label: 'Deleted', colorDot: 'bg-rose-500' },
              { value: 'posted', label: 'Posted', colorDot: 'bg-purple-500' },
              { value: 'voided', label: 'Voided', colorDot: 'bg-amber-500' },
            ]}
            value={selectedAction}
            onChange={(val) => setSelectedAction(val)}
            size="sm"
            aria-label="Filter audit logs by action"
          />
        </div>

        <span className="text-xs text-slate-500">{filteredLogs.length} audit entries captured</span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type & Record ID</th>
                <th className="px-4 py-3">Changed Fields</th>
                <th className="px-4 py-3">Origin IP / Agent</th>
                <th className="px-4 py-3 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-slate-500">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-slate-500">
                    No audit records found. Actions performed across the system will be recorded here automatically.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.user?.name || 'System / Batch'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {log.auditable_type} #{log.auditable_id}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.changed_fields && log.changed_fields.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {log.changed_fields.map((f) => (
                          <span
                            key={f}
                            className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{log.ip}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Diff
                    </button>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before / After Diff Inspector Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-indigo-600" />
                  Audit State Diff — {selectedLog.auditable_type} #{selectedLog.auditable_id}
                </h3>
                <span className="text-xs text-slate-500">
                  Correlation ID: {selectedLog.correlation_id} | Actor: {selectedLog.user?.name}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                <span className="font-semibold block mb-1">Context / Reason:</span>
                <pre className="font-mono text-[11px] whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.context, null, 2)}
                </pre>
              </div>
            )}

            {/* Side-by-side Before & After */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-rose-700 flex items-center gap-1">
                  Before Mutation
                </span>
                <pre className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg font-mono text-[11px] text-slate-800 overflow-x-auto min-h-40">
                  {JSON.stringify(selectedLog.before, null, 2)}
                </pre>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  After Mutation
                </span>
                <pre className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg font-mono text-[11px] text-slate-800 overflow-x-auto min-h-40">
                  {JSON.stringify(selectedLog.after, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

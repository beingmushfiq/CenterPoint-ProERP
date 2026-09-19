import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
import type { PlatformAnnouncement, PlatformTenant } from '../../types/api/platform';
import { Button } from '../../components/ui/Button';
import {
  RotateCcw,
  Plus,
  AlertTriangle,
  Info,
  Flame,
  Clock,
  Trash2,
} from 'lucide-react';

export const PlatformAnnouncementsWorkspace: React.FC = () => {
  const { t } = useTranslation(['platform', 'common']);
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [targetType, setTargetType] = useState<'all' | 'specific_tenants' | 'plan'>('all');
  const [targetTenantId, setTargetTenantId] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState<string>('');
  const [isDismissible, setIsDismissible] = useState<boolean>(true);

  // Fetch Tenants for targeted broadcast
  const { data: tenants = [] } = useQuery<PlatformTenant[]>({
    queryKey: ['platform', 'tenants', 'simple-list'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PlatformTenant[] } | PlatformTenant[]>('/platform/tenants?per_page=100');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Announcements
  const { data: announcements = [], isLoading, isFetching, refetch } = useQuery<PlatformAnnouncement[]>({
    queryKey: ['platform', 'announcements'],
    queryFn: async () => {
      const res = await api.get<{ data: PlatformAnnouncement[] } | PlatformAnnouncement[]>('/platform/announcements');
      if (Array.isArray(res.data)) return res.data;
      if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [];
    },
  });

  // Create Announcement Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      body: string;
      severity: 'info' | 'warning' | 'critical';
      target_type: 'all' | 'plan' | 'tenant';
      target_ids?: number[];
      publish_at?: string;
      expires_at?: string;
      is_active: boolean;
    }) => {
      const res = await api.post('/platform/announcements', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Broadcast announcement posted');
      setShowCreateModal(false);
      setTitle('');
      setBody('');
      setSeverity('info');
      setTargetType('all');
      setTargetTenantId('');
      setEndsAt('');
      queryClient.invalidateQueries({ queryKey: ['platform', 'announcements'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create announcement';
      toast.error(msg);
    },
  });

  // Update Announcement Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; is_active?: boolean; title?: string; body?: string; severity?: string }) => {
      const res = await api.patch(`/platform/announcements/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Announcement status updated');
      queryClient.invalidateQueries({ queryKey: ['platform', 'announcements'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update announcement';
      toast.error(msg);
    },
  });

  // Delete Announcement Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/platform/announcements/${id}`);
    },
    onSuccess: () => {
      toast.success('Announcement removed');
      queryClient.invalidateQueries({ queryKey: ['platform', 'announcements'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete announcement';
      toast.error(msg);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      toast.error('Title and message body are required');
      return;
    }

    const payload: {
      title: string;
      body: string;
      severity: 'info' | 'warning' | 'critical';
      target_type: 'all' | 'plan' | 'tenant';
      target_ids?: number[];
      publish_at?: string;
      expires_at?: string;
      is_active: boolean;
    } = {
      title,
      body,
      severity,
      target_type: targetType === 'specific_tenants' ? 'tenant' : targetType === 'plan' ? 'plan' : 'all',
      is_active: true,
    };

    if (targetType === 'specific_tenants' && targetTenantId) {
      payload.target_ids = [Number(targetTenantId)];
    }
    if (startsAt) {
      payload.publish_at = startsAt;
    }
    if (endsAt) {
      payload.expires_at = endsAt;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight">{t('announcements.title')}</h1>
          <p className="text-xs text-muted mt-1 font-mono">
            {t('announcements.description')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 font-mono text-xs cursor-pointer border-default bg-surface text-default hover:bg-surface-sunken"
          >
            <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{t('announcements.refresh')}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 font-mono text-xs font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            <Plus className="size-4" />
            <span>{t('announcements.newAnnouncement')}</span>
          </Button>
        </div>
      </div>

      {/* Announcements List */}
      <div className="rounded-2xl bg-surface border border-default shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted font-mono text-xs">
            {t('announcements.loading')}
          </div>
        ) : announcements.length > 0 ? (
          <div className="divide-y divide-default font-mono text-xs">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-5 flex items-start justify-between gap-4 hover:bg-surface-sunken/60 transition-colors">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ann.severity === 'critical'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : ann.severity === 'warning'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {ann.severity === 'critical' && <Flame className="size-2.5" />}
                      {ann.severity === 'warning' && <AlertTriangle className="size-2.5" />}
                      {ann.severity === 'info' && <Info className="size-2.5" />}
                      <span>{ann.severity}</span>
                    </span>

                    <span className="font-bold text-default font-sans text-sm">{ann.title}</span>

                    <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-default text-muted text-[10px] uppercase">
                      {ann.target_type}
                    </span>
                  </div>

                  <p className="text-default text-xs font-sans whitespace-pre-wrap leading-relaxed">
                    {ann.body}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-muted pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>{t('announcements.starts')}: {ann.publish_at ? new Date(ann.publish_at).toLocaleString() : new Date(ann.created_at).toLocaleString()}</span>
                    </span>
                    {ann.expires_at && (
                      <span>{t('announcements.expires')}: {new Date(ann.expires_at).toLocaleString()}</span>
                    )}
                    <span>{ann.is_active ? t('announcements.statusActive') : t('announcements.statusArchived')}</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateMutation.mutate({ id: ann.id, is_active: !ann.is_active })}
                    title={ann.is_active ? t('announcements.archiveTooltip') : t('announcements.reactivateTooltip')}
                    className="p-1.5 rounded-lg bg-surface-sunken hover:bg-surface border border-default text-amber-500 cursor-pointer transition-colors"
                  >
                    <Clock className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('announcements.deleteConfirm'))) {
                        deleteMutation.mutate(ann.id);
                      }
                    }}
                    title={t('announcements.deleteTooltip')}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted font-mono text-xs">
            {t('announcements.emptyTitle')}
          </div>
        )}
      </div>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-default rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-xs">
            <h2 className="text-lg font-bold text-default font-sans">{t('announcements.modal.title')}</h2>
            <p className="text-muted mt-1">
              {t('announcements.modal.subtitle')}
            </p>

            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-default mb-1">{t('announcements.modal.titleLabel')}</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('announcements.modal.titlePlaceholder')}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default mb-1">{t('announcements.modal.severityLabel')}</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'info' | 'warning' | 'critical')}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                >
                  <option value="info">{t('announcements.modal.severityInfo')}</option>
                  <option value="warning">{t('announcements.modal.severityWarning')}</option>
                  <option value="critical">{t('announcements.modal.severityCritical')}</option>
                </select>
              </div>

              <div>
                <label className="block text-default mb-1">{t('announcements.modal.targetLabel')}</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as 'all' | 'specific_tenants' | 'plan')}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                >
                  <option value="all">{t('announcements.modal.targetAll')}</option>
                  <option value="specific_tenants">{t('announcements.modal.targetSpecific')}</option>
                </select>
              </div>

              {targetType === 'specific_tenants' && (
                <div>
                  <label className="block text-default mb-1">{t('announcements.modal.targetTenantLabel')}</label>
                  <select
                    value={targetTenantId}
                    onChange={(e) => setTargetTenantId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="">{t('announcements.modal.selectTenant')}</option>
                    {tenants.map((tItem) => (
                      <option key={tItem.id} value={tItem.id}>
                        {tItem.name} ({tItem.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-default mb-1">{t('announcements.modal.bodyLabel')}</label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('announcements.modal.bodyPlaceholder')}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500 resize-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-default mb-1">{t('announcements.modal.startsAtLabel')}</label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-default mb-1">{t('announcements.modal.endsAtLabel')}</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDismissibleCheckbox"
                  checked={isDismissible}
                  onChange={(e) => setIsDismissible(e.target.checked)}
                  className="rounded-sm border-default bg-surface-sunken text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isDismissibleCheckbox" className="text-default cursor-pointer">
                  {t('announcements.modal.dismissibleLabel')}
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default cursor-pointer"
                >
                  {t('announcements.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !title || !body}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending ? t('announcements.modal.publishingBtn') : t('announcements.modal.publishBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAnnouncementsWorkspace;

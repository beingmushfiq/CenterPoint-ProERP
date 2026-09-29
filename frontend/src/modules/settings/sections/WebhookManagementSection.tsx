import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Send,
  History,
  Trash2,
  Edit2,
  AlertTriangle,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { Button } from '../../../components/ui/Button';
import { Modal, ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { extractList } from '../../../lib/api/apiData';
import { cn } from '../../../lib/utils';

export interface WebhookEndpoint {
  id: number;
  uuid: string;
  tenant_id: number;
  url: string;
  secret?: string;
  signing_secret?: string;
  events: string[];
  is_active: boolean;
  disabled_reason?: string | null;
  consecutive_failures?: number;
  deliveries_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface WebhookDelivery {
  id: number;
  uuid: string;
  tenant_id: number;
  webhook_endpoint_id: number;
  event_type: string;
  payload: Record<string, unknown>;
  response_status_code?: number | null;
  response_headers?: Record<string, unknown> | null;
  response_body?: string | null;
  attempt_count: number;
  status: 'pending' | 'delivered' | 'failed';
  error_message?: string | null;
  sent_at?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

const COMMON_EVENTS = [
  { id: '*', label: 'All Platform Events (*)', category: 'Wildcard' },
  { id: 'order.created', label: 'Order Created', category: 'Sales & Orders' },
  { id: 'order.updated', label: 'Order Updated', category: 'Sales & Orders' },
  { id: 'order.paid', label: 'Order Paid', category: 'Sales & Orders' },
  { id: 'order.fulfilled', label: 'Order Fulfilled', category: 'Sales & Orders' },
  { id: 'delivery.dispatched', label: 'Delivery Dispatched', category: 'Logistics' },
  { id: 'delivery.delivered', label: 'Delivery Completed', category: 'Logistics' },
  { id: 'inventory.low_stock', label: 'Inventory Low Stock Alert', category: 'Inventory' },
  { id: 'inventory.movement', label: 'Stock Movement Recorded', category: 'Inventory' },
  { id: 'production.batch_completed', label: 'Production Batch Completed', category: 'Manufacturing' },
  { id: 'qc.inspection_failed', label: 'QC Inspection Failed', category: 'Quality' },
  { id: 'invoice.paid', label: 'Invoice Settled', category: 'Finance' },
  { id: 'customer.created', label: 'Customer Account Created', category: 'CRM' },
];

export const WebhookManagementSection: React.FC = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Registration & Editing Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null);
  const [formUrl, setFormUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['order.created', 'order.paid']);
  const [customEventInput, setCustomEventInput] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Secret Reveal Modal (only shown once right after creation)
  const [revealedSecret, setRevealedSecret] = useState<{ url: string; secret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Delivery History Modal
  const [selectedEndpointForHistory, setSelectedEndpointForHistory] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedDeliveryDetail, setSelectedDeliveryDetail] = useState<WebhookDelivery | null>(null);

  // Ping Testing State
  const [pingingId, setPingingId] = useState<string | number | null>(null);

  // Deletion Confirm Dialog
  const [endpointToDelete, setEndpointToDelete] = useState<WebhookEndpoint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch Endpoints
  const loadEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<WebhookEndpoint[]>('/integrations/webhooks');
      const list = extractList<WebhookEndpoint>(res);
      setEndpoints(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load webhook endpoints.';
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints, refreshKey]);

  // Handle Form Open for Create / Edit
  const handleOpenCreate = () => {
    setEditingEndpoint(null);
    setFormUrl('');
    setSelectedEvents(['order.created', 'order.paid']);
    setCustomEventInput('');
    setFormIsActive(true);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (ep: WebhookEndpoint) => {
    setEditingEndpoint(ep);
    setFormUrl(ep.url);
    setSelectedEvents(ep.events || []);
    setCustomEventInput('');
    setFormIsActive(ep.is_active);
    setIsFormModalOpen(true);
  };

  // Toggle event selection
  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) => {
      if (eventId === '*') {
        return prev.includes('*') ? [] : ['*'];
      }
      const filtered = prev.filter((e) => e !== '*');
      if (filtered.includes(eventId)) {
        return filtered.filter((e) => e !== eventId);
      }
      return [...filtered, eventId];
    });
  };

  // Add custom event
  const handleAddCustomEvent = () => {
    const trimmed = customEventInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!selectedEvents.includes(trimmed)) {
      setSelectedEvents((prev) => [...prev, trimmed]);
    }
    setCustomEventInput('');
  };

  // Save / Submit Endpoint
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim()) {
      notify.error('Please specify a valid webhook URL.');
      return;
    }
    if (selectedEvents.length === 0) {
      notify.error('Please select at least one event type to subscribe to.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingEndpoint) {
        // Update
        const payload = {
          url: formUrl.trim(),
          events: selectedEvents,
          is_active: formIsActive,
        };
        await api.patch(`/integrations/webhooks/${editingEndpoint.uuid || editingEndpoint.id}`, payload);
        notify.success('Webhook endpoint updated successfully.');
        setIsFormModalOpen(false);
        loadEndpoints();
      } else {
        // Create
        const payload = {
          url: formUrl.trim(),
          events: selectedEvents,
          is_active: formIsActive,
        };
        const res = await api.post<{ success: boolean; data: WebhookEndpoint & { signing_secret: string } }>(
          '/integrations/webhooks',
          payload
        );
        const createdData = res.data?.data;
        notify.success('Webhook endpoint registered successfully.');
        setIsFormModalOpen(false);
        loadEndpoints();

        if (createdData?.signing_secret) {
          setRevealedSecret({
            url: createdData.url,
            secret: createdData.signing_secret,
          });
          setCopiedSecret(false);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save webhook endpoint.';
      notify.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Endpoint
  const handleDeleteEndpoint = async () => {
    if (!endpointToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/integrations/webhooks/${endpointToDelete.uuid || endpointToDelete.id}`);
      notify.success('Webhook endpoint deleted successfully.');
      setEndpointToDelete(null);
      loadEndpoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete webhook endpoint.';
      notify.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Test Ping
  const handleTestPing = async (ep: WebhookEndpoint) => {
    setPingingId(ep.id);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        data?: WebhookDelivery;
      }>(`/integrations/webhooks/${ep.uuid || ep.id}/ping`, {});
      const delivery = res.data?.data;
      const status = delivery?.status ?? 'delivered';
      const code = delivery?.response_status_code;

      if (status === 'delivered') {
        notify.success(`Ping dispatched successfully! Server responded with HTTP ${code ?? 200}.`);
      } else {
        notify.warning(
          `Ping dispatched, but receiver responded with HTTP ${code ?? 'error'}: ${delivery?.error_message || 'Receiver returned non-2xx status.'}`
        );
      }
      loadEndpoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webhook ping failed.';
      notify.error(msg);
    } finally {
      setPingingId(null);
    }
  };

  // View Delivery History
  const handleOpenHistory = async (ep: WebhookEndpoint) => {
    setSelectedEndpointForHistory(ep);
    setLoadingHistory(true);
    setSelectedDeliveryDetail(null);
    try {
      const res = await api.get<{
        success: boolean;
        data: {
          endpoint: WebhookEndpoint;
          recent_deliveries: WebhookDelivery[];
        };
      }>(`/integrations/webhooks/${ep.uuid || ep.id}`);
      const recent = res.data?.data?.recent_deliveries || [];
      setDeliveries(recent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load delivery history.';
      notify.error(msg);
      setDeliveries([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Copy secret to clipboard
  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    notify.success('Signing secret copied to clipboard.');
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  // Calculate aggregates
  const activeCount = endpoints.filter((e) => e.is_active).length;
  const totalDeliveries = endpoints.reduce((acc, curr) => acc + (curr.deliveries_count ?? 0), 0);
  const totalFailures = endpoints.reduce((acc, curr) => acc + (curr.consecutive_failures ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-default pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Radio className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-default tracking-tight">Enterprise Webhook Subsystems</h2>
              <p className="text-xs text-muted">
                Real-time cryptographic event notifications with HMAC SHA-256 verification and outbox delivery audit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="text-xs gap-1.5"
            title="Refresh webhooks list"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Register Webhook</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-default bg-surface p-4 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">Registered Endpoints</span>
          <div className="text-xl font-bold font-mono text-default">{endpoints.length}</div>
          <span className="text-[11px] text-muted block">{activeCount} active stream{activeCount === 1 ? '' : 's'}</span>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">Active Streams</span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <span className="text-[11px] text-muted block">Listening to ERP events</span>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">Lifetime Deliveries</span>
          <div className="text-xl font-bold font-mono text-default">{totalDeliveries}</div>
          <span className="text-[11px] text-muted block">Outbox dispatches recorded</span>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">Consecutive Failures</span>
          <div className={cn('text-xl font-bold font-mono', totalFailures > 0 ? 'text-rose-500' : 'text-muted')}>
            {totalFailures}
          </div>
          <span className="text-[11px] text-muted block">
            {totalFailures > 0 ? 'Review endpoint status' : 'All endpoints healthy'}
          </span>
        </div>
      </div>

      {/* Endpoints List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-default bg-surface">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : endpoints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-default bg-surface-sunken p-12 text-center space-y-3">
          <Radio className="size-10 text-muted mx-auto" />
          <h4 className="text-sm font-bold text-default">No Webhook Endpoints Registered</h4>
          <p className="text-xs text-muted max-w-md mx-auto">
            Connect external microservices, messaging bots, and accounting engines to receive real-time payload updates
            whenever records are created or status transitions occur.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              <span>Register First Endpoint</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {endpoints.map((ep) => {
            const hasFailures = (ep.consecutive_failures ?? 0) > 0;
            return (
              <div
                key={ep.id}
                className={cn(
                  'rounded-2xl border bg-surface p-5 space-y-4 transition-all shadow-xs',
                  ep.is_active ? 'border-default hover:border-primary/40' : 'border-rose-500/20 bg-rose-500/5'
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Endpoint URL & Status */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ep.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          DISABLED
                        </span>
                      )}

                      {hasFailures && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="size-2.5" />
                          {ep.consecutive_failures} failures
                        </span>
                      )}

                      <span className="text-[11px] font-mono text-muted">
                        Deliveries: {ep.deliveries_count ?? 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Globe className="size-3.5 text-muted shrink-0" />
                      <span className="font-mono text-xs font-bold text-default break-all">{ep.url}</span>
                    </div>

                    {ep.disabled_reason && (
                      <p className="text-[11px] text-rose-500 font-medium">
                        Deactivated reason: {ep.disabled_reason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTestPing(ep)}
                      disabled={pingingId === ep.id}
                      className="text-xs h-8 gap-1.5"
                      title="Dispatch instant test ping event"
                    >
                      <Send className={cn('size-3 text-primary', pingingId === ep.id && 'animate-spin')} />
                      <span>{pingingId === ep.id ? 'Pinging...' : 'Test Ping'}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenHistory(ep)}
                      className="text-xs h-8 gap-1.5"
                      title="Inspect delivery history"
                    >
                      <History className="size-3 text-muted" />
                      <span>Deliveries</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(ep)}
                      className="text-xs h-8 p-2"
                      title="Edit webhook configuration"
                    >
                      <Edit2 className="size-3.5 text-primary" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEndpointToDelete(ep)}
                      className="text-xs h-8 p-2 text-rose-500 hover:bg-rose-500/10"
                      title="Delete webhook"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Subscribed Events Tags */}
                <div className="pt-2 border-t border-default/60 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-muted mr-1">Events:</span>
                  {ep.events?.map((ev) => (
                    <span
                      key={ev}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-mono font-medium border',
                        ev === '*'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-bold'
                          : 'bg-surface-sunken text-default border-default'
                      )}
                    >
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Secret Reveal Modal (One-Time Display) */}
      {revealedSecret && (
        <Modal
          open={!!revealedSecret}
          onClose={() => setRevealedSecret(null)}
          title="Webhook Signing Secret Generated"
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Save Your Signing Secret Now</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                For cryptographic security, this signing secret will only be displayed once. Copy and store it in your server
                environment variables to verify webhook signatures using HMAC SHA-256 header <code className="text-primary font-mono text-[11px]">X-SliceMart-Signature</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase text-muted block">Endpoint URL</label>
              <div className="rounded-lg border border-default bg-surface-sunken p-2.5 font-mono text-xs text-default break-all">
                {revealedSecret.url}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase text-muted block">Signing Secret</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-default bg-surface-sunken p-2.5 font-mono text-xs text-primary font-bold break-all select-all">
                  {revealedSecret.secret}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCopySecret(revealedSecret.secret)}
                  className="gap-1.5 shrink-0"
                >
                  {copiedSecret ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-default flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setRevealedSecret(null)}>
                I Have Saved My Secret
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Registration / Edit Modal */}
      {isFormModalOpen && (
        <Modal
          open={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingEndpoint ? 'Configure Webhook Endpoint' : 'Register Webhook Endpoint'}
          size="lg"
        >
          <form onSubmit={handleSubmitForm} className="space-y-5">
            {/* Target URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-default block">
                Target Payload URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://api.yourdomain.com/webhooks/fms"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface px-3.5 py-2.5 font-mono text-xs text-default placeholder-muted focus:border-primary focus:outline-none shadow-xs"
              />
              <p className="text-[11px] text-muted">
                Must be a publicly accessible HTTPS endpoint capable of returning a 2xx HTTP response code.
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-default bg-surface-sunken p-3.5">
              <div>
                <span className="text-xs font-bold text-default block">Enable Webhook Stream</span>
                <span className="text-[11px] text-muted block">
                  When enabled, real-time events will be signed and delivered immediately upon occurrence.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-sunken border border-default peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            {/* Event Subscriptions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-default block">
                  Subscribed Events ({selectedEvents.length} selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEvents(['*'])}
                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    Select All Wildcard (*)
                  </button>
                  <span className="text-muted">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEvents([])}
                    className="text-[11px] text-muted hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1 border border-default rounded-xl bg-surface-sunken">
                {COMMON_EVENTS.map((ev) => {
                  const isSelected = selectedEvents.includes(ev.id) || selectedEvents.includes('*');
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => toggleEvent(ev.id)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer border',
                        isSelected
                          ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                          : 'border-transparent bg-surface text-default hover:border-default'
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="block truncate">{ev.label}</span>
                        <span className="block font-mono text-[10px] text-muted truncate">{ev.id}</span>
                      </div>
                      <div
                        className={cn(
                          'size-4 rounded border flex items-center justify-center shrink-0',
                          isSelected ? 'border-primary bg-primary text-white' : 'border-default bg-surface'
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Event Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Custom event key (e.g. pos.session.closed)"
                  value={customEventInput}
                  onChange={(e) => setCustomEventInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomEvent();
                    }
                  }}
                  className="flex-1 rounded-xl border border-default bg-surface px-3 py-1.5 font-mono text-xs text-default placeholder-muted focus:border-primary focus:outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddCustomEvent}
                  className="text-xs"
                >
                  Add Event
                </Button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsFormModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? 'Saving...' : editingEndpoint ? 'Update Endpoint' : 'Register Webhook'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delivery History Modal */}
      {selectedEndpointForHistory && (
        <Modal
          open={!!selectedEndpointForHistory}
          onClose={() => setSelectedEndpointForHistory(null)}
          title={`Delivery History: ${selectedEndpointForHistory.url}`}
          size="xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs text-muted pb-2 border-b border-default">
              <span>Recent 20 outbox deliveries</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenHistory(selectedEndpointForHistory)}
                disabled={loadingHistory}
                className="h-7 text-[11px] gap-1"
              >
                <RefreshCw className={cn('size-3', loadingHistory && 'animate-spin')} />
                <span>Refresh Logs</span>
              </Button>
            </div>

            {loadingHistory ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No deliveries have been recorded yet for this endpoint.
              </div>
            ) : (
              <div className="space-y-2">
                {deliveries.map((del) => {
                  const isSuccess = del.status === 'delivered';
                  const isDetailOpen = selectedDeliveryDetail?.id === del.id;

                  return (
                    <div
                      key={del.id}
                      className="rounded-xl border border-default bg-surface overflow-hidden divide-y divide-default/40"
                    >
                      <div
                        onClick={() => setSelectedDeliveryDetail(isDetailOpen ? null : del)}
                        className="flex items-center justify-between p-3 text-xs hover:bg-surface-sunken/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                              HTTP {del.response_status_code ?? 200}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[10px] font-bold border border-rose-500/20">
                              {del.response_status_code ? `HTTP ${del.response_status_code}` : 'FAILED'}
                            </span>
                          )}

                          <span className="font-mono font-semibold text-default">{del.event_type}</span>
                          <span className="text-[11px] text-muted font-mono">
                            {new Date(del.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {del.duration_ms && (
                            <span className="text-[11px] text-muted font-mono">{del.duration_ms} ms</span>
                          )}
                          <ChevronRight
                            className={cn('size-3.5 text-muted transition-transform', isDetailOpen && 'rotate-90')}
                          />
                        </div>
                      </div>

                      {/* Detail Drawer */}
                      {isDetailOpen && (
                        <div className="p-4 bg-surface-sunken space-y-3 text-xs">
                          {del.error_message && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400 text-xs">
                              <strong>Delivery Error:</strong> {del.error_message}
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold uppercase text-muted block">Payload Dispatched</span>
                            <pre className="rounded-lg border border-default bg-surface p-3 font-mono text-[11px] text-default overflow-x-auto max-h-48 whitespace-pre-wrap">
                              {JSON.stringify(del.payload, null, 2)}
                            </pre>
                          </div>

                          {del.response_body && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold uppercase text-muted block">Receiver Response Body</span>
                              <pre className="rounded-lg border border-default bg-surface p-3 font-mono text-[11px] text-default overflow-x-auto max-h-32 whitespace-pre-wrap">
                                {del.response_body}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {endpointToDelete && (
        <ConfirmDialog
          open={!!endpointToDelete}
          onClose={() => setEndpointToDelete(null)}
          onConfirm={handleDeleteEndpoint}
          title="Delete Webhook Endpoint?"
          message={`Are you sure you want to permanently remove the webhook endpoint '${endpointToDelete.url}'? Outgoing event notifications to this URL will cease immediately.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete Webhook'}
          variant="danger"
        />
      )}
    </div>
  );
};

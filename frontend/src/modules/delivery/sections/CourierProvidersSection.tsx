import React, { useState } from 'react';
import type { CourierProvider } from '../../../types/api/delivery';
import { useCurrency } from '../../../hooks/useCurrency';
import { CheckCircle2, XCircle, Settings, ShieldCheck, Truck, X } from 'lucide-react';

interface CourierProvidersSectionProps {
  providers: CourierProvider[];
  onSaveProvider: (provider: Partial<CourierProvider>) => Promise<void>;
  onToggleActive: (provider: CourierProvider) => Promise<void>;
}

export const CourierProvidersSection: React.FC<CourierProvidersSectionProps> = ({
  providers,
  onSaveProvider,
  onToggleActive,
}) => {
  const { formatCurrency } = useCurrency();
  const [selectedProvider, setSelectedProvider] = useState<CourierProvider | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CourierProvider>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const capabilitiesList = [
    { key: 'create_shipment', label: 'Consignment Creation' },
    { key: 'cancel_shipment', label: 'Online Cancellation' },
    { key: 'get_status', label: 'Live Tracking Sync' },
    { key: 'get_label', label: 'Shipping Label Download' },
    { key: 'calculate_rate', label: 'Dynamic Rate Calculation' },
    { key: 'schedule_pickup', label: 'Pickup Scheduling' },
    { key: 'webhooks', label: 'Inbound Webhooks' },
    { key: 'cod_collection', label: 'Cash on Delivery (COD)' },
  ];

  const handleOpenEdit = (provider: CourierProvider) => {
    setSelectedProvider(provider);
    setFormData({
      code: provider.code,
      name: provider.name,
      default_charge: provider.default_charge,
      is_active: provider.is_active,
    });
    setIsEditModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;
    setIsSubmitting(true);
    try {
      await onSaveProvider({ ...formData, id: selectedProvider.id });
      setIsEditModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-default font-sans flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <span>Courier Partners & Capability Matrix</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Configure 3PL logistics provider credentials, default charges, and inspect supported features.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShieldCheck className="size-3.5" />
            {providers.filter((p) => p.is_active).length} Active Carriers
          </span>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {providers.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-default bg-surface p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-token-colors space-y-4"
          >
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-default">
                    {p.name}
                  </h3>
                  <span className="font-mono text-[10px] font-semibold text-muted tracking-wider uppercase">
                    CARRIER CODE: {p.code}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    p.is_active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-surface-sunken text-muted border border-default'
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-muted'}`} />
                  {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="rounded-xl border border-default bg-surface-sunken/40 p-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Standard Rate:</span>
                  <span className="font-mono font-bold text-default">
                    {formatCurrency(p.default_charge)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Adapter Driver:</span>
                  <span className="font-mono text-muted truncate max-w-45">
                    {p.adapter_class.split('\\').pop()}
                  </span>
                </div>
              </div>

              {/* Capability Matrix Badges */}
              <div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                  SUPPORTED CAPABILITIES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {capabilitiesList.map((cap) => {
                    const isSupported = p.capabilities?.[cap.key] ?? true;
                    return (
                      <span
                        key={cap.key}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          isSupported
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : 'bg-surface-sunken text-muted/50 border border-default/40 line-through'
                        }`}
                      >
                        {isSupported ? (
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="size-3 text-muted/50 shrink-0" />
                        )}
                        <span>{cap.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-default pt-3">
              <button
                type="button"
                onClick={() => onToggleActive(p)}
                className="rounded-xl border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-default hover:bg-surface-sunken transition-all cursor-pointer shadow-2xs"
              >
                {p.is_active ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => handleOpenEdit(p)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
              >
                <Settings className="size-3.5" />
                <span>Configure</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Provider Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface-raised p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">
                Configure {selectedProvider?.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-default mb-1.5">
                  Default Delivery Charge
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.default_charge || ''}
                  onChange={(e) => setFormData({ ...formData, default_charge: e.target.value })}
                  required
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs font-medium text-default placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-default bg-surface px-3.5 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-fg hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Compass, Plus, Check, Trash2, Globe, Phone, UserCheck, Share2, Sparkles } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { toast } from 'sonner';
import { LEAD_SOURCES, type SourceConfig } from '../constants';
import type { Lead, LeadSource } from '../../../types/api/crm';

interface LeadSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads?: Lead[];
}

export function LeadSourcesModal({ isOpen, onClose, leads = [] }: LeadSourcesModalProps) {
  const [sourcesList, setSourcesList] = useState<SourceConfig[]>(LEAD_SOURCES);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [channelType, setChannelType] = useState<'inbound' | 'outbound' | 'digital' | 'partner'>('digital');

  const getSourceStats = (sourceId: string) => {
    const matched = leads.filter((l) => l.source === sourceId);
    const wonCount = matched.filter((l) => (l.stage || l.status) === 'won').length;
    const rate = matched.length > 0 ? ((wonCount / matched.length) * 100).toFixed(0) : '0';
    return { count: matched.length, won: wonCount, conversionRate: `${rate}%` };
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      toast.error('Source label cannot be empty');
      return;
    }

    const id = newLabel.trim().toLowerCase().replace(/\s+/g, '_') as LeadSource;
    if (sourcesList.some((s) => s.id === id)) {
      toast.error('This acquisition source already exists');
      return;
    }

    const newSource: SourceConfig = {
      id,
      label: newLabel.trim(),
    };

    setSourcesList((prev) => [...prev, newSource]);
    setNewLabel('');
    setIsAdding(false);
    toast.success(`Acquisition Channel "${newLabel}" created successfully.`);
  };

  const getSourceIcon = (sourceId: string) => {
    if (sourceId.includes('phone')) return <Phone className="size-3.5 text-blue-500" />;
    if (sourceId.includes('social') || sourceId.includes('event')) return <Share2 className="size-3.5 text-purple-500" />;
    if (sourceId.includes('referral') || sourceId.includes('visit') || sourceId.includes('walk_in'))
      return <UserCheck className="size-3.5 text-emerald-500" />;
    return <Globe className="size-3.5 text-indigo-500" />;
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Lead Acquisition Sources & Attribution"
      size="lg"
    >
      <div className="space-y-5 p-1 text-default">
        <div className="flex items-center justify-between pb-3 border-b border-default">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="size-3.5 text-primary" />
              Inbound & Outbound Channels ({sourcesList.length})
            </h4>
            <p className="text-2xs text-muted">
              Configure attribution channels, customer touchpoints, and track acquisition conversion velocity.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs"
          >
            <Plus className="size-3.5 mr-1" />
            {isAdding ? 'Cancel' : 'New Source'}
          </Button>
        </div>

        {isAdding && (
          <form
            onSubmit={handleAddSource}
            className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs font-bold text-default">Add Acquisition Channel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Channel Display Name
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., LinkedIn Campaign, WhatsApp Inbound..."
                  autoFocus
                  className="w-full text-xs px-3 py-2 rounded-xl border border-default bg-surface text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Channel Classification
                </label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as typeof channelType)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-default bg-surface text-default focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="digital">Digital / Web</option>
                  <option value="inbound">Direct Inbound</option>
                  <option value="outbound">Direct Outbound</option>
                  <option value="partner">Partner / Referral</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" variant="primary" className="text-xs">
                <Check className="size-3.5 mr-1" />
                Register Source
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
          {sourcesList.map((src) => {
            const stats = getSourceStats(src.id);
            return (
              <div
                key={src.id}
                className="flex items-start justify-between p-3.5 rounded-xl border border-default bg-surface hover:border-default/80 transition-all shadow-2xs space-y-2"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-surface-sunken flex items-center justify-center shrink-0 border border-default/60">
                      {getSourceIcon(src.id)}
                    </div>
                    <span className="text-xs font-bold text-default truncate">{src.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-2xs text-muted font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-surface-sunken border border-default/40">
                      {src.id}
                    </span>
                    <span>• {stats.count} leads</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      ({stats.conversionRate} win)
                    </span>
                  </div>
                </div>

                {src.id !== 'storefront' && src.id !== 'walk_in' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSourcesList((prev) => prev.filter((s) => s.id !== src.id));
                      toast.success(`Removed source "${src.label}".`);
                    }}
                    className="p-1 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Remove source"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-default flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

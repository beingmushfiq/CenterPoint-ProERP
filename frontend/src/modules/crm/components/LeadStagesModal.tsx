import React, { useState } from 'react';
import { Layers, Plus, Check, Trash2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { toast } from 'sonner';
import { STAGES, type StageConfig } from '../constants';
import type { Lead } from '../../../types/api/crm';

interface LeadStagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads?: Lead[];
}

export function LeadStagesModal({ isOpen, onClose, leads = [] }: LeadStagesModalProps) {
  const [stagesList, setStagesList] = useState<StageConfig[]>(STAGES);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTone, setNewTone] = useState<'sky' | 'blue' | 'indigo' | 'purple' | 'amber' | 'emerald' | 'rose'>('indigo');
  const [winProbability, setWinProbability] = useState<number>(50);

  const getStageCount = (stageId: string) => {
    return leads.filter((l) => (l.stage || l.status) === stageId).length;
  };

  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      toast.error('Stage label cannot be empty');
      return;
    }

    const id = newLabel.trim().toLowerCase().replace(/\s+/g, '_') as StageConfig['id'];
    if (stagesList.some((s) => s.id === id)) {
      toast.error('A stage with this identifier already exists');
      return;
    }

    const toneMap = {
      sky: { tone: 'text-sky-600 dark:text-sky-400', dotBg: 'bg-sky-500', badgeBg: 'bg-sky-500/10 border-sky-500/20' },
      blue: { tone: 'text-blue-600 dark:text-blue-400', dotBg: 'bg-blue-500', badgeBg: 'bg-blue-500/10 border-blue-500/20' },
      indigo: { tone: 'text-indigo-600 dark:text-indigo-400', dotBg: 'bg-indigo-500', badgeBg: 'bg-indigo-500/10 border-indigo-500/20' },
      purple: { tone: 'text-purple-600 dark:text-purple-400', dotBg: 'bg-purple-500', badgeBg: 'bg-purple-500/10 border-purple-500/20' },
      amber: { tone: 'text-amber-600 dark:text-amber-400', dotBg: 'bg-amber-500', badgeBg: 'bg-amber-500/10 border-amber-500/20' },
      emerald: { tone: 'text-emerald-600 dark:text-emerald-400', dotBg: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10 border-emerald-500/20' },
      rose: { tone: 'text-rose-600 dark:text-rose-400', dotBg: 'bg-rose-500', badgeBg: 'bg-rose-500/10 border-rose-500/20' },
    };

    const newStage: StageConfig = {
      id,
      label: newLabel.trim(),
      ...toneMap[newTone],
    };

    setStagesList((prev) => [...prev, newStage]);
    setNewLabel('');
    setIsAdding(false);
    toast.success(`Pipeline Stage "${newLabel}" configured successfully.`);
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === stagesList.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...stagesList];
    const [moved] = updated.splice(index, 1);
    if (moved) {
      updated.splice(targetIndex, 0, moved);
      setStagesList(updated);
      toast.success('Stage sequence updated.');
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Commercial Pipeline Stages Configuration"
      size="lg"
    >
      <div className="space-y-5 p-1 text-default">
        <div className="flex items-center justify-between pb-3 border-b border-default">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Active Qualification Stages ({stagesList.length})
            </h4>
            <p className="text-2xs text-muted">
              Define the progression criteria, probability weights, and milestone gates for commercial deals.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs"
          >
            <Plus className="size-3.5 mr-1" />
            {isAdding ? 'Cancel' : 'New Stage'}
          </Button>
        </div>

        {isAdding && (
          <form
            onSubmit={handleAddStage}
            className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs font-bold text-default">Create Custom Deal Stage</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Stage Display Name
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Tech Assessment, Contract Review..."
                  autoFocus
                  className="w-full text-xs px-3 py-2 rounded-xl border border-default bg-surface text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Color Accent
                </label>
                <select
                  value={newTone}
                  onChange={(e) => setNewTone(e.target.value as typeof newTone)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-default bg-surface text-default focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="sky">Sky Blue</option>
                  <option value="blue">Royal Blue</option>
                  <option value="indigo">Indigo</option>
                  <option value="purple">Purple</option>
                  <option value="amber">Amber</option>
                  <option value="emerald">Emerald</option>
                  <option value="rose">Rose</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted">Win Probability:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={winProbability}
                  onChange={(e) => setWinProbability(Number(e.target.value))}
                  className="w-16 text-xs px-2 py-1 rounded-lg border border-default bg-surface text-default font-mono"
                />
                <span className="text-xs font-mono text-muted">%</span>
              </div>
              <Button type="submit" size="sm" variant="primary" className="text-xs">
                <Check className="size-3.5 mr-1" />
                Save Stage
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {stagesList.map((stage, idx) => {
            const count = getStageCount(stage.id);
            const isFirst = idx === 0;
            const isLast = idx === stagesList.length - 1;

            return (
              <div
                key={stage.id}
                className="flex items-center justify-between p-3 rounded-xl border border-default bg-surface hover:border-default/80 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="size-5 rounded-md bg-surface-sunken text-[10px] font-mono text-muted flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className={`size-2.5 rounded-full ${stage.dotBg} shrink-0`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-default truncate">{stage.label}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${stage.badgeBg} ${stage.tone}`}>
                        {stage.id}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted font-mono">
                      {count} active lead{count !== 1 ? 's' : ''} in pipeline
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveStage(idx, 'up')}
                    disabled={isFirst}
                    className="p-1 rounded-lg border border-default text-muted hover:text-default hover:bg-surface-sunken disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                    title="Move stage earlier"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(idx, 'down')}
                    disabled={isLast}
                    className="p-1 rounded-lg border border-default text-muted hover:text-default hover:bg-surface-sunken disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
                    title="Move stage later"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  {stage.id !== 'won' && stage.id !== 'lost' && stage.id !== 'new' && (
                    <button
                      type="button"
                      onClick={() => {
                        setStagesList((prev) => prev.filter((s) => s.id !== stage.id));
                        toast.success(`Removed stage "${stage.label}".`);
                      }}
                      className="p-1 rounded-lg border border-default text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete stage"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
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

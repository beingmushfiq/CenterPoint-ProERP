import React, { useState } from 'react';
import { History, Printer, RefreshCw, X, CheckCircle2, Clock, CloudOff, AlertCircle } from 'lucide-react';
import { getRecentReceipts, getQueuedOfflineSales, removeQueuedOfflineSale, type PosOfflineReceipt } from '../utils/posHardware';
import { api } from '../../../lib/api/client';
import { notify } from '../../../components/ui/Toast';

interface PosRecentReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReprintReceipt: (receipt: PosOfflineReceipt) => void;
  currencySymbol: string;
}

export const PosRecentReceiptsModal: React.FC<PosRecentReceiptsModalProps> = ({
  isOpen,
  onClose,
  onReprintReceipt,
  currencySymbol,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'offline_queue'>('history');
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState<PosOfflineReceipt[]>(getRecentReceipts);
  const [queuedSales, setQueuedSales] = useState(getQueuedOfflineSales);

  if (!isOpen) return null;

  const handleSyncQueuedSale = async (queuedId: string) => {
    const target = queuedSales.find((s) => s.id === queuedId);
    if (!target) return;

    setIsSyncing(true);
    try {
      await api.post('/pos/checkout', target.payload);
      removeQueuedOfflineSale(queuedId);
      setQueuedSales(getQueuedOfflineSales());
      setRecentReceipts(getRecentReceipts());
      notify.success('Offline sale synced successfully to server!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Server error occurred';
      notify.error(`Sync failed: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    if (queuedSales.length === 0) return;
    setIsSyncing(true);
    let successCount = 0;

    for (const sale of queuedSales) {
      try {
        await api.post('/pos/checkout', sale.payload);
        removeQueuedOfflineSale(sale.id);
        successCount++;
      } catch {}
    }

    setQueuedSales(getQueuedOfflineSales());
    setIsSyncing(false);

    if (successCount > 0) {
      notify.success(`Synced ${successCount} offline sales to server!`);
    } else {
      notify.error('Could not sync offline sales. Check internet connection.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface border border-default shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recent-receipts-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-default flex items-center justify-between bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <History className="size-4" />
            </div>
            <div>
              <h2 id="recent-receipts-title" className="text-sm font-bold text-default flex items-center gap-2">
                Recent Receipts &amp; Offline Cache
                {queuedSales.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {queuedSales.length} Pending Offline
                  </span>
                )}
              </h2>
              <p className="text-2xs text-muted">Instant re-print and offline transaction recovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="size-7 rounded-lg border border-default hover:bg-surface-sunken text-muted hover:text-default flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-default flex items-center gap-2 bg-surface">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-default'
            }`}
          >
            <Printer className="size-3.5" /> Recent Receipts ({recentReceipts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('offline_queue')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'offline_queue'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-default'
            }`}
          >
            <CloudOff className="size-3.5" /> Offline Sync Queue ({queuedSales.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {activeTab === 'history' ? (
            recentReceipts.length === 0 ? (
              <div className="py-12 text-center text-muted text-xs space-y-2">
                <Clock className="size-8 mx-auto text-muted/50" />
                <p>No recent receipts cached in this session yet.</p>
                <p className="text-2xs text-muted/70">Completed sales will automatically appear here for instant 1-click re-printing.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentReceipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl border border-default bg-surface-sunken/40 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-default">
                          {rec.orderNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-bold uppercase bg-surface border border-default text-muted">
                          {rec.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-2xs text-muted">
                        <span>{new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span>•</span>
                        <span>{rec.itemsCount} {rec.itemsCount === 1 ? 'item' : 'items'}</span>
                        {rec.customerName && (
                          <>
                            <span>•</span>
                            <span className="text-default font-medium">{rec.customerName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-primary block">
                          {currencySymbol} {rec.total.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onReprintReceipt(rec)}
                        className="px-2.5 py-1.5 rounded-lg border border-default bg-surface hover:bg-primary hover:text-primary-contrast hover:border-primary text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Re-print Thermal Receipt"
                      >
                        <Printer className="size-3.5" /> Re-print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : queuedSales.length === 0 ? (
            <div className="py-12 text-center text-muted text-xs space-y-2">
              <CheckCircle2 className="size-8 mx-auto text-success/60" />
              <p className="font-bold text-default">All Transactions Synced</p>
              <p className="text-2xs text-muted/70">No pending offline sales waiting for synchronization.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-500">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{queuedSales.length} transaction(s) pending sync to server.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="px-3 py-1 rounded-lg bg-amber-500 text-white font-medium text-xs hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync All
                </button>
              </div>

              {queuedSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3 rounded-xl border border-default bg-surface-sunken/40 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono text-xs font-bold text-default block">
                      Queue ID: {sale.id}
                    </span>
                    <span className="text-2xs text-muted block">
                      {new Date(sale.timestamp).toLocaleTimeString()} • {sale.itemsCount} items
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-default mr-2">
                      {currencySymbol} {sale.total.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSyncQueuedSale(sale.id)}
                      disabled={isSyncing}
                      className="px-2.5 py-1 rounded-lg bg-primary text-primary-contrast font-medium text-xs hover:bg-primary-hover disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-default bg-surface-raised flex items-center justify-between text-2xs text-muted">
          <span>Cached locally in browser memory for uninterrupted retail uptime</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-default hover:bg-surface-sunken font-medium text-xs text-default cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

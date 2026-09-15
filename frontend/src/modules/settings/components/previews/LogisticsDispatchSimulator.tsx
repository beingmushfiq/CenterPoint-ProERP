import React from 'react';
import {
  Truck,
  Barcode,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../../../../lib/api/client';

interface LogisticsDispatchSimulatorProps {
  defaultCourierProvider?: string;
  autoBookCourier?: boolean | string;
  codChargePercentage?: number | string;
}

export const LogisticsDispatchSimulator: React.FC<LogisticsDispatchSimulatorProps> = ({
  defaultCourierProvider = 'steadfast',
  autoBookCourier = true,
  codChargePercentage = 1,
}) => {
  const codRate = Number(codChargePercentage) || 0;
  const sampleOrderTotal = 3500;
  const calculatedCodFee = (sampleOrderTotal * codRate) / 100;
  const netPayable = sampleOrderTotal + calculatedCodFee;

  const isAutoBook = autoBookCourier === true || autoBookCourier === '1' || autoBookCourier === 'true';

  const courierNames: Record<string, string> = {
    steadfast: 'Steadfast Courier Ltd.',
    pathao: 'Pathao Courier & Express',
    redx: 'REDX Express Logistics',
  };

  return (
    <div className="rounded-xl border border-default bg-surface-sunken/60 overflow-hidden space-y-0 transition-all">
      {/* Top Bar */}
      <div className="px-4 py-3 bg-surface border-b border-default flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-default block">
              Logistics Parcel Dispatch &amp; COD Simulator
            </span>
            <span className="text-2xs text-muted block">
              Live automated courier consignment booking, parcel label generation, and COD fee calculation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-2xs text-muted">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          <span className="capitalize">{courierNames[defaultCourierProvider] || defaultCourierProvider}</span>
        </div>
      </div>

      {/* Simulator Content Area */}
      <div className="p-4">
        {/* Parcel Shipping Label Specimen */}
        <div className="max-w-md mx-auto rounded-xl border-2 border-default bg-surface p-4 shadow-sm space-y-3">
          {/* Label Header */}
          <div className="flex items-center justify-between border-b-2 border-default pb-3">
            <div className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              <div>
                <span className="text-xs font-bold text-default uppercase tracking-wider block">
                  {courierNames[defaultCourierProvider] || defaultCourierProvider}
                </span>
                <span className="text-2xs text-muted font-mono">Consignment #SF-2026-98124</span>
              </div>
            </div>

            <div className="text-right">
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-primary/10 text-primary uppercase">
                Zone: Dhaka Metro
              </span>
            </div>
          </div>

          {/* Recipient & Routing */}
          <div className="grid grid-cols-2 gap-3 text-2xs">
            <div className="space-y-0.5">
              <span className="text-muted block font-medium">SHIP TO:</span>
              <p className="font-bold text-default">Karim Industrial Mart</p>
              <p className="text-muted">Plot 14, Tejgaon I/A, Dhaka</p>
              <p className="font-mono text-default">+880 1712-345678</p>
            </div>
            <div className="space-y-0.5 text-right">
              <span className="text-muted block font-medium">DISPATCH POLICY:</span>
              <p className="font-semibold text-default">
                {isAutoBook ? '⚡ Auto-Consigned' : 'Manual Dispatch Gate'}
              </p>
              <p className="text-muted">Standard Express Air/Road</p>
            </div>
          </div>

          {/* COD Breakdown Box */}
          <div className="p-2.5 rounded-lg bg-surface-sunken border border-default space-y-1">
            <div className="flex justify-between text-2xs">
              <span className="text-muted">Parcel Invoice Subtotal:</span>
              <span className="font-mono text-default">৳ {sampleOrderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-muted">COD Service Surcharge ({codRate}%):</span>
              <span className="font-mono text-default">৳ {calculatedCodFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold border-t border-default pt-1 text-default">
              <span>Total Cash on Delivery:</span>
              <span className="font-mono text-primary">৳ {netPayable.toFixed(2)} BDT</span>
            </div>
          </div>

          {/* Barcode Strip */}
          <div className="pt-2 border-t border-default flex items-center justify-between">
            <div className="flex items-center gap-1 font-mono text-2xs text-muted">
              <Barcode className="size-4 text-default" />
              <span>SF98124-COD</span>
            </div>
            <button
              type="button"
              onClick={() => {
                void api.post(`/webhooks/couriers/${defaultCourierProvider || 'steadfast'}`, {
                  event: 'delivery_status_updated',
                  consignment_id: 'SF98124-COD',
                  status: 'delivered',
                }).catch(() => {});
              }}
              className="text-2xs text-success font-medium flex items-center gap-1 hover:underline cursor-pointer"
              title="Test Courier Webhook"
            >
              <Zap className="size-2.5" /> Ready for Dock Pickup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

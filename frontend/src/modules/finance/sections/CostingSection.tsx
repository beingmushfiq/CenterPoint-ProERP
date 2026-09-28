import React from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import { Calculator } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { ProductCost } from '../../../types/api/finance';

export interface CostingSectionProps {
  productCosts: ProductCost[];
  onRollupCosting?: (productId: number) => void;
}

export const CostingSection: React.FC<CostingSectionProps> = ({
  productCosts,
  onRollupCosting,
}) => {
  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-default shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-default flex items-center gap-2">
            <Calculator className="size-4 text-primary" />
            <span>Manufacturing Standard Unit Cost Rollup</span>
          </h3>
          <p className="text-xs text-muted">
            Multi-level BOM cost aggregation combining raw materials, piece-rate labour, and factory overhead rates
          </p>
        </div>
        {onRollupCosting && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onRollupCosting(1)}
            className="shadow-md shadow-primary/20 self-start sm:self-auto"
          >
            <Calculator className="size-3.5 mr-1.5" />
            <span>Recalculate Cost Rollup</span>
          </Button>
        )}
      </div>

      <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
        <table className="w-full text-left text-xs text-default">
          <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
            <tr>
              <th className="px-5 py-3.5">Product / SKU</th>
              <th className="px-5 py-3.5 text-right">Material Cost</th>
              <th className="px-5 py-3.5 text-right">Piece-rate Labour</th>
              <th className="px-5 py-3.5 text-right">Factory Overhead</th>
              <th className="px-5 py-3.5 text-right">Standard Unit Cost</th>
              <th className="px-5 py-3.5">Effective Date</th>
              <th className="px-5 py-3.5 text-center">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {productCosts.map((pc) => (
              <tr key={pc.id} className="hover:bg-surface-sunken/40 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-default">
                    {pc.product?.name}
                  </div>
                  <div className="text-[11px] font-mono text-muted">{pc.product?.sku}</div>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-default">
                  {formatCurrency(pc.material_cost)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-amber-500 font-semibold">
                  {formatCurrency(pc.labour_cost)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-default">
                  {formatCurrency(pc.overhead_cost)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-success">
                  {formatCurrency(pc.total_cost)}
                </td>
                <td className="px-5 py-3.5 text-xs text-muted">{pc.effective_from}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary-subtle text-primary border border-primary/20 rounded-full">
                    {pc.source.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CostingSection;

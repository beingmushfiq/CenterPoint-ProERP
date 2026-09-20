import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  FileCheck2,
  Landmark,
  Factory,
  Hash,
  FileBadge,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface LegalIdentifierFieldProps {
  label: string;
  settingKey: string;
  value: unknown;
  onChange: (val: string) => void;
  description?: string | undefined;
}

interface FieldConfigItem {
  icon: React.ElementType;
  authorityTag: string;
  placeholder: string;
  contextHint: string;
}

const FIELD_CONFIG: Record<string, FieldConfigItem> = {
  company_name: {
    icon: Building2,
    authorityTag: 'Operating Brand / Trade Name',
    placeholder: 'e.g. Acme Brands',
    contextHint: 'The operational brand name displayed in workspaces, headers, and client communications.',
  },
  company_legal_name: {
    icon: Building2,
    authorityTag: 'Primary Legal Entity',
    placeholder: 'e.g. Acme Industries Ltd.',
    contextHint: 'Official name printed on commercial invoices, delivery challans, and statutory tax filings.',
  },
  trade_license_no: {
    icon: ShieldCheck,
    authorityTag: 'City Corporation Permit',
    placeholder: 'e.g. TRAD/DNCC/019283/2024',
    contextHint: 'Municipal trade license permit authorizing commercial and industrial enterprise operations.',
  },
  tax_identification_number: {
    icon: FileCheck2,
    authorityTag: 'NBR VAT 6.3 Registered',
    placeholder: 'e.g. BIN-99210029381',
    contextHint: 'National Board of Revenue 13-digit Business Identification Number (BIN) / VAT registration.',
  },
  rjsc_registration_no: {
    icon: Landmark,
    authorityTag: 'RJSC Incorporation',
    placeholder: 'e.g. C-184920/2023',
    contextHint: 'Registrar of Joint Stock Companies & Firms official entity incorporation number.',
  },
  factory_license_no: {
    icon: Factory,
    authorityTag: 'DIFE Safety Compliance',
    placeholder: 'e.g. DIFE/DHK/IND-04829',
    contextHint: 'Department of Inspection for Factories & Establishments manufacturing license number.',
  },
  bin_branch_code: {
    icon: Hash,
    authorityTag: 'Tax Jurisdiction Unit',
    placeholder: 'e.g. 0001 (Tejgaon Central Plant)',
    contextHint: 'Four-digit NBR branch code designating this specific manufacturing plant or warehouse unit.',
  },
};

export const LegalIdentifierField: React.FC<LegalIdentifierFieldProps> = ({
  label,
  settingKey,
  value,
  onChange,
  description,
}) => {
  const [copied, setCopied] = useState(false);
  const strVal = typeof value === 'string' ? value : String(value ?? '');
  const config = FIELD_CONFIG[settingKey] || {
    icon: FileBadge,
    authorityTag: 'Statutory Registry',
    placeholder: 'Enter registration identifier...',
    contextHint: 'Official enterprise statutory parameter.',
  };

  const Icon = config.icon;
  const isNameField = settingKey === 'company_legal_name';

  const handleCopy = () => {
    if (!strVal) return;
    navigator.clipboard.writeText(strVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group rounded-xl border border-default/80 bg-surface p-4 transition-all duration-200 hover:border-default hover:shadow-2xs space-y-2.5">
      {/* Field Label & Authority Tag */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`field-${settingKey}`}
          className="flex items-center gap-2 text-xs font-semibold text-default cursor-pointer"
        >
          <Icon className="size-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
          <span>{label}</span>
        </label>
        {config.authorityTag && (
          <span className="text-[10px] font-medium text-muted bg-surface-sunken border border-default/60 px-2 py-0.5 rounded-md select-none shrink-0">
            {config.authorityTag}
          </span>
        )}
      </div>

      {/* Input Field with Sleek Inline Copy */}
      <div className="relative flex items-center">
        <input
          id={`field-${settingKey}`}
          type="text"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder}
          className={cn(
            'w-full rounded-lg border border-default bg-surface-sunken/40 py-2 text-xs text-default placeholder:text-muted/50 transition-all focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
            isNameField
              ? 'font-medium text-sm px-3'
              : 'font-mono font-medium px-3 pr-9 tracking-tight'
          )}
        />
        {!isNameField && strVal && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy identifier"
            className="absolute right-2 p-1 rounded-md text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Un-truncated Helpful Context Note */}
      <p className="text-[11px] text-muted leading-relaxed">
        {description || config.contextHint}
      </p>
    </div>
  );
};

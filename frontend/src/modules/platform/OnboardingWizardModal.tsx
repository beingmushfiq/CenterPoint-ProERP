// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING WIZARD MODAL                                 UI_SYSTEM.md §10.2
// ───────────────────────────────────────────────────────────────────────────
// Beautiful interactive popup wizard replacing the full-page route at
// `/onboarding`. Contains the same 6 setup steps as OnboardingWizard.tsx but
// wrapped in a premium modal shell with:
//   - Left sidebar step navigator (220px fixed, hidden on mobile)
//   - Right animated content panel (Framer Motion AnimatePresence, slide x)
//   - Top bar: step counter pill + 6-segment progress track + live score + X
//   - Full focus trap + Escape key + backdrop click to close
//   - All UX states: loading, saving, API error, success
//   - Dark mode via token system; reduced motion via CSS tokens
//
// Design (antislop-ui compliance):
//   - Single glass: scrim backdrop only (1-cap honored)
//   - One shadow on modal panel (shadow-2xl) — elevation, not decoration
//   - Amber accent ONE use: time estimate tag on the active step in sidebar
//   - No gradients, no glow, no endless loops
//   - Progress track fills only on actual step save
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useId,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  type Variants,
} from 'framer-motion';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Rocket,
  RefreshCw,
  Building2,
  Coins,
  Warehouse,
  Factory,
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../../components/ui/Button';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { notify } from '../../components/ui/Toast';
import { IndustryProfilePicker } from './IndustryProfilePicker';
import { enterBase, exitFast, craft } from '../../lib/motion/tokens';
import type { IndustryProfileTemplate, ProductionStageConfig } from '../../lib/capabilities/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardStepMeta {
  id: number;
  key: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  estimatedTime: string;
  icon: React.FC<{ className?: string }>;
}

export interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
}

// ── Step Definitions ─────────────────────────────────────────────────────────

const WIZARD_STEPS: WizardStepMeta[] = [
  {
    id: 1, key: 'legal_identity',
    title: 'Legal Identity & Tax', shortTitle: 'Legal & Tax',
    subtitle: 'Company name, Trade License, VAT/TIN, Registered Office',
    estimatedTime: '2 min', icon: Building2,
  },
  {
    id: 2, key: 'financial_defaults',
    title: 'Financial Localization', shortTitle: 'Financials',
    subtitle: 'Operating Currency, Timezone & Fiscal Calendar',
    estimatedTime: '1 min', icon: Coins,
  },
  {
    id: 3, key: 'operational_facilities',
    title: 'Facilities & Warehousing', shortTitle: 'Facilities',
    subtitle: 'Central Factory Warehouse, Physical Depot & POS Counter',
    estimatedTime: '2 min', icon: Warehouse,
  },
  {
    id: 4, key: 'industry_blueprint',
    title: 'Industry Blueprint', shortTitle: 'Blueprint',
    subtitle: 'Sector Template & Manufacturing Model',
    estimatedTime: '3 min', icon: Factory,
  },
  {
    id: 5, key: 'workflow_stages',
    title: 'Subsystems & Floor Stages', shortTitle: 'Modules',
    subtitle: 'Active Modules & Sequential Routing Gates',
    estimatedTime: '3 min', icon: Layers,
  },
  {
    id: 6, key: 'standards_branding',
    title: 'Standards, Branding & Launch', shortTitle: 'Launch',
    subtitle: 'Units of Measure, Invoicing Terms & Workspace Theme',
    estimatedTime: '2 min', icon: SlidersHorizontal,
  },
];

const BUSINESS_MODELS = [
  { key: 'manufacturing', label: 'Manufacturing & Processing', desc: 'Produce goods from raw materials with BOM & stages.' },
  { key: 'wholesale', label: 'Wholesale & B2B Distribution', desc: 'Bulk supply to dealers, supermarkets, and corporate buyers.' },
  { key: 'retail', label: 'Retail & POS Outlets', desc: 'Physical showroom counters with fast POS barcode checkout.' },
  { key: 'ecommerce', label: 'Direct E-Commerce', desc: 'Online storefront with delivery tracking.' },
  { key: 'trading', label: 'Trading & Brokering', desc: 'Procure and fulfill without factory manufacturing.' },
];

const MANUFACTURING_TYPES = [
  { key: 'discrete', label: 'Discrete Manufacturing', desc: 'Countable items (garments, furniture, electronics).' },
  { key: 'process', label: 'Process / Recipe', desc: 'Liquid or bulk batch blending (food, pharma, chemicals).' },
  { key: 'job_shop', label: 'Job Shop & Custom Build', desc: 'Made-to-order custom fabrication and prototyping.' },
  { key: 'assembly', label: 'Assembly & Kitting', desc: 'Combining pre-fabricated components into finished sets.' },
  { key: 'none', label: 'None / Pure Distribution', desc: 'Trading and logistics only, no manufacturing chain.' },
];

const ALL_MODULES = [
  { key: 'production', label: 'Production Chain & BOM', category: 'Operations' },
  { key: 'inventory', label: 'Stock & Multi-Warehouse', category: 'Operations' },
  { key: 'qc', label: 'Quality Control (QC)', category: 'Operations' },
  { key: 'purchasing', label: 'Procurement (PO) & Bills', category: 'Supply Chain' },
  { key: 'sales', label: 'B2B Sales & Invoicing', category: 'Supply Chain' },
  { key: 'pos', label: 'Point of Sale (POS)', category: 'Commerce' },
  { key: 'ecommerce', label: 'Storefront CMS & Webshop', category: 'Commerce' },
  { key: 'delivery', label: 'Courier & 3PL Logistics', category: 'Logistics' },
  { key: 'finance', label: 'Finance & Accounts Ledger', category: 'Enterprise' },
  { key: 'assets', label: 'Fixed Assets & Machinery', category: 'Enterprise' },
  { key: 'hr', label: 'Workforce & HR Payroll', category: 'Enterprise' },
  { key: 'reports', label: 'Reports & BI RMS', category: 'Intelligence' },
];

const AVAILABLE_UNITS = ['PCS', 'KG', 'BOX', 'PACK', 'LTR', 'MTR', 'TON', 'PAIR', 'ROLL', 'SET'];

// ── Motion Variants ───────────────────────────────────────────────────────────

const scrimVariants: Variants = {
  hidden: { opacity: 0, transition: exitFast },
  visible: { opacity: 1, transition: enterBase },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: craft.modalScaleFrom, transition: exitFast },
  visible: { opacity: 1, scale: 1, transition: enterBase },
};

// Step slide: forward x 20→0, backward x -20→0
const stepVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 20 : -20, opacity: 0 }),
  center: {
    x: 0, opacity: 1,
    transition: { duration: 0.18, ease: [0.05, 0.7, 0.1, 1] },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -20 : 20, opacity: 0,
    transition: { duration: 0.14, ease: [0.3, 0, 0.8, 0.15] },
  }),
};

// ── Shared form helpers ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-default bg-surface-sunken px-3 py-2.5 text-xs text-default placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors';

function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
      {children}
      {required && <span className="text-danger ml-0.5" aria-label="required">*</span>}
    </label>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({
  companyName, setCompanyName,
  companyLegalName, setCompanyLegalName,
  tradeLicense, setTradeLicense,
  taxNumber, setTaxNumber,
  registeredAddress, setRegisteredAddress,
  officialPhone, setOfficialPhone,
  officialEmail, setOfficialEmail,
  setWarehouseAddress,
}: {
  companyName: string; setCompanyName: (v: string) => void;
  companyLegalName: string; setCompanyLegalName: (v: string) => void;
  tradeLicense: string; setTradeLicense: (v: string) => void;
  taxNumber: string; setTaxNumber: (v: string) => void;
  registeredAddress: string; setRegisteredAddress: (v: string) => void;
  officialPhone: string; setOfficialPhone: (v: string) => void;
  officialEmail: string; setOfficialEmail: (v: string) => void;
  setWarehouseAddress: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <FL required>Operating Brand Name</FL>
        <input className={inputCls} type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Apex Manufacturing Ltd" />
      </div>
      <div>
        <FL required>Registered Legal Entity Name</FL>
        <input className={inputCls} type="text" value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} placeholder="e.g. Apex Industrial Holdings Incorporated" />
      </div>
      <div>
        <FL>Trade License Number</FL>
        <input className={inputCls} type="text" value={tradeLicense} onChange={(e) => setTradeLicense(e.target.value)} placeholder="e.g. TRAD/DNCC/012948/2026" />
      </div>
      <div>
        <FL required>Tax ID / VAT Registration / BIN</FL>
        <input className={inputCls} type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="e.g. BIN-002849182-0102" />
      </div>
      <div className="sm:col-span-2">
        <FL required>Registered Corporate Address</FL>
        <textarea
          rows={2}
          value={registeredAddress}
          onChange={(e) => { setRegisteredAddress(e.target.value); setWarehouseAddress(e.target.value); }}
          placeholder="e.g. Plot 42, Sector 7, Export Processing Zone, Dhaka 1230"
          className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2.5 text-xs text-default placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
        />
      </div>
      <div>
        <FL>Official Support Phone</FL>
        <input className={inputCls} type="tel" value={officialPhone} onChange={(e) => setOfficialPhone(e.target.value)} placeholder="e.g. +880 2 9876543" />
      </div>
      <div>
        <FL>Official Billing Email</FL>
        <input className={inputCls} type="email" value={officialEmail} onChange={(e) => setOfficialEmail(e.target.value)} placeholder="e.g. accounts@apexholdings.com" />
      </div>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({
  currencyCode, setCurrencyCode,
  timezone, setTimezone,
  fiscalYearStart, setFiscalYearStart,
}: {
  currencyCode: string; setCurrencyCode: (v: string) => void;
  timezone: string; setTimezone: (v: string) => void;
  fiscalYearStart: string; setFiscalYearStart: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <div>
        <FL required>Operating Base Currency</FL>
        <SelectDropdown
          options={[
            { value: 'BDT', label: 'BDT (৳) — Bangladeshi Taka' },
            { value: 'USD', label: 'USD ($) — US Dollar' },
            { value: 'EUR', label: 'EUR (€) — Euro' },
            { value: 'GBP', label: 'GBP (£) — British Pound' },
            { value: 'AED', label: 'AED (د.إ) — UAE Dirham' },
            { value: 'SAR', label: 'SAR (﷼) — Saudi Riyal' },
            { value: 'INR', label: 'INR (₹) — Indian Rupee' },
          ]}
          value={currencyCode}
          onChange={setCurrencyCode}
        />
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">Defines accounting ledger valuation and default sales pricing.</p>
      </div>
      <div>
        <FL required>Operating Timezone</FL>
        <SelectDropdown
          options={[
            { value: 'Asia/Dhaka', label: 'Asia/Dhaka (GMT+6)' },
            { value: 'UTC', label: 'UTC (GMT+0)' },
            { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
            { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
            { value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT+5:30)' },
            { value: 'Europe/London', label: 'Europe/London (GMT+1)' },
            { value: 'America/New_York', label: 'America/New_York (EST)' },
          ]}
          value={timezone}
          onChange={setTimezone}
        />
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">Used for batch logs, shift timestamps, and audit trails.</p>
      </div>
      <div>
        <FL>Fiscal Year Start</FL>
        <SelectDropdown
          options={[
            { value: 'July', label: 'July (Standard BD/AU)' },
            { value: 'January', label: 'January (Calendar Year)' },
            { value: 'April', label: 'April (Standard UK/IN)' },
          ]}
          value={fiscalYearStart}
          onChange={setFiscalYearStart}
        />
      </div>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function Step3({
  warehouseName, setWarehouseName,
  warehouseAddress, setWarehouseAddress,
  posCounterName, setPosCounterName,
}: {
  warehouseName: string; setWarehouseName: (v: string) => void;
  warehouseAddress: string; setWarehouseAddress: (v: string) => void;
  posCounterName: string; setPosCounterName: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <FL required>Primary Central Warehouse / Depot Name</FL>
        <input className={inputCls} type="text" value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} placeholder="e.g. Main Factory Central Warehouse" />
        <p className="text-[11px] text-muted mt-1.5">Where raw materials and finished goods are stocked initially.</p>
      </div>
      <div>
        <FL>Default POS Cash Counter / Outlet Name</FL>
        <input className={inputCls} type="text" value={posCounterName} onChange={(e) => setPosCounterName(e.target.value)} placeholder="e.g. Main Showroom Register 01" />
      </div>
      <div className="sm:col-span-2">
        <FL>Facility Physical Location / Address</FL>
        <input className={inputCls} type="text" value={warehouseAddress} onChange={(e) => setWarehouseAddress(e.target.value)} placeholder="e.g. Industrial Shed B-4, Storage Zone 1" />
      </div>
    </div>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

function Step4({
  selectedIndustry,
  businessTypes, setBusinessTypes,
  manufacturingType, setManufacturingType,
  onApplyProfile,
}: {
  selectedIndustry: string;
  businessTypes: string[]; setBusinessTypes: (v: string[]) => void;
  manufacturingType: string; setManufacturingType: (v: string) => void;
  onApplyProfile: (p: IndustryProfileTemplate) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <FL>Industry Blueprint Preset</FL>
        <IndustryProfilePicker selectedKey={selectedIndustry} onSelect={onApplyProfile} />
      </div>
      <div className="pt-4 border-t border-default/60">
        <FL>Business Operation Channels</FL>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUSINESS_MODELS.map((bm) => {
            const on = businessTypes.includes(bm.key);
            return (
              <label key={bm.key} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${on ? 'border-primary bg-primary/5' : 'border-default bg-surface-sunken hover:border-default-strong'}`}>
                <input type="checkbox" checked={on} className="mt-0.5 rounded border-default text-primary focus:ring-primary shrink-0"
                  onChange={(e) => setBusinessTypes(e.target.checked ? [...businessTypes, bm.key] : businessTypes.filter((k) => k !== bm.key))} />
                <div>
                  <div className="text-xs font-semibold text-default">{bm.label}</div>
                  <div className="text-[11px] text-muted mt-0.5 leading-snug">{bm.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
      <div className="pt-4 border-t border-default/60">
        <FL>Manufacturing Flow Structure</FL>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {MANUFACTURING_TYPES.map((mt) => {
            const on = manufacturingType === mt.key;
            return (
              <button key={mt.key} type="button" onClick={() => setManufacturingType(mt.key)}
                className={`text-left rounded-xl border p-3 transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-default bg-surface-sunken text-default hover:border-default-strong'}`}>
                <div className="text-xs font-semibold">{mt.label}</div>
                <div className="text-[11px] text-muted mt-1 leading-snug">{mt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Step 5 ────────────────────────────────────────────────────────────────────

function Step5({
  enabledModules, setEnabledModules,
  productionStages, setProductionStages,
}: {
  enabledModules: string[]; setEnabledModules: (v: string[]) => void;
  productionStages: ProductionStageConfig[]; setProductionStages: (v: ProductionStageConfig[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <FL>Active Departmental Subsystems</FL>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {ALL_MODULES.map((mod) => {
            const on = enabledModules.includes(mod.key);
            return (
              <label key={mod.key} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${on ? 'border-primary bg-primary/5 font-semibold text-default' : 'border-default text-muted hover:border-default-strong'}`}>
                <input type="checkbox" checked={on} className="rounded border-default text-primary focus:ring-primary shrink-0"
                  onChange={(e) => setEnabledModules(e.target.checked ? [...enabledModules, mod.key] : enabledModules.filter((k) => k !== mod.key))} />
                <span className="truncate text-[11px]">{mod.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="pt-4 border-t border-default/60 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <FL>Production Floor Routing Stages</FL>
            <p className="text-[11px] text-muted -mt-1">Sequential steps required before output is stocked in warehouse.</p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs flex items-center gap-1 shrink-0"
            onClick={() => {
              const n = productionStages.length + 1;
              setProductionStages([...productionStages, { key: `stage_${n}`, label: `Custom Stage ${n}`, sort_order: n, is_qc_stage: false }]);
            }}>
            <Plus className="size-3.5" /><span>Add Stage</span>
          </Button>
        </div>
        <div className="space-y-2">
          {productionStages.map((stage, idx) => (
            <div key={stage.key} className="flex items-center gap-3 rounded-xl border border-default bg-surface-sunken p-3 text-xs">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">{idx + 1}</span>
              <input type="text" value={stage.label} className="flex-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                onChange={(e) => {
                  const u = [...productionStages]; u[idx] = { ...stage, label: e.target.value }; setProductionStages(u);
                }} />
              <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer shrink-0">
                <input type="checkbox" checked={stage.is_qc_stage} className="rounded border-default text-primary"
                  onChange={(e) => {
                    const u = [...productionStages]; u[idx] = { ...stage, is_qc_stage: e.target.checked }; setProductionStages(u);
                  }} />
                <span>QC Gate</span>
              </label>
              {productionStages.length > 1 && (
                <button type="button" onClick={() => setProductionStages(productionStages.filter((_, i) => i !== idx))}
                  className="text-muted hover:text-danger p-1 transition-colors" title={`Remove ${stage.label}`} aria-label={`Remove ${stage.label}`}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 6 ────────────────────────────────────────────────────────────────────

function Step6({
  selectedUnits, setSelectedUnits,
  brandColor, setBrandColor,
  logoUrl, setLogoUrl,
  invoiceTerms, setInvoiceTerms,
  warehouseName,
}: {
  selectedUnits: string[]; setSelectedUnits: (v: string[]) => void;
  brandColor: string; setBrandColor: (v: string) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  invoiceTerms: string; setInvoiceTerms: (v: string) => void;
  warehouseName: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <FL required>Active Units of Measure (UoM)</FL>
        <div className="flex flex-wrap gap-2 mt-1">
          {AVAILABLE_UNITS.map((u) => {
            const on = selectedUnits.includes(u);
            return (
              <button key={u} type="button" onClick={() => {
                if (on) { if (selectedUnits.length > 1) setSelectedUnits(selectedUnits.filter((x) => x !== u)); }
                else setSelectedUnits([...selectedUnits, u]);
              }} className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${on ? 'border-primary bg-primary text-white' : 'border-default bg-surface-sunken text-muted hover:text-default hover:border-default-strong'}`}>
                {u}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-default/60">
        <div>
          <FL>Primary Brand Theme Accent Color</FL>
          <div className="flex items-center gap-2">
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
              className="size-9 rounded-lg border border-default bg-transparent cursor-pointer" aria-label="Pick brand color" />
            <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
              className="flex-1 rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs font-mono text-default focus:border-primary focus:outline-none" />
          </div>
        </div>
        <div>
          <FL>Brand Logo URL (Optional)</FL>
          <input className={inputCls} type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://your-domain.com/logo.png" />
        </div>
        <div className="sm:col-span-2">
          <FL>Official Invoicing Terms & Delivery Challan Notice</FL>
          <textarea rows={3} value={invoiceTerms} onChange={(e) => setInvoiceTerms(e.target.value)}
            className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2.5 text-xs text-default focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors resize-none" />
        </div>
      </div>
      {/* Graduation panel — functional info, not decoration */}
      <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-success font-semibold text-xs">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Ready for 100% Workspace Graduation</span>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">
          Completing this setup will provision your default central warehouse ({warehouseName || 'Main Warehouse'}),
          units of measure ({selectedUnits.join(', ')}), legal invoice headers, and production floor stages.
          The onboarding prompt will be permanently retired.
        </p>
      </div>
    </div>
  );
}

// ── Sidebar Step Nav Item ─────────────────────────────────────────────────────

function StepNavItem({
  step, isCompleted, isActive, onClick,
}: {
  step: WizardStepMeta; isCompleted: boolean; isActive: boolean; onClick: () => void;
}) {
  const Icon = step.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isCompleted && !isActive}
      aria-current={isActive ? 'step' : undefined}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        isActive
          ? 'border-l-2 border-primary bg-primary/8 text-default'
          : isCompleted
          ? 'hover:bg-surface/60 text-muted cursor-pointer'
          : 'text-subtle cursor-default'
      }`}
    >
      <div className={`flex size-7 items-center justify-center rounded-lg shrink-0 transition-colors ${
        isActive ? 'bg-primary/15 text-primary' : isCompleted ? 'bg-success/10 text-success' : 'bg-surface text-subtle'
      }`}>
        {isCompleted ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-default' : isCompleted ? 'text-muted' : 'text-subtle'}`}>
          {step.shortTitle}
        </div>
        {/* Amber accent — one deliberate use: active step time estimate */}
        {isActive && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="size-2.5 text-accent shrink-0" />
            <span className="text-[10px] text-accent font-medium">{step.estimatedTime}</span>
          </div>
        )}
      </div>
      {!isCompleted && !isActive && (
        <span className="text-[10px] font-mono text-subtle shrink-0">{step.id}</span>
      )}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  initialStep = 1,
}) => {
  const navigate = useNavigate();
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const invalidateManifest = useTenantCapabilityStore((s) => s.invalidate);
  const bootstrapManifest = useTenantCapabilityStore((s) => s.bootstrap);
  const tenant = useAuthStore((s) => s.tenant);

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [companyName, setCompanyName] = useState(tenant?.name || '');
  const [companyLegalName, setCompanyLegalName] = useState(tenant?.name || '');
  const [tradeLicense, setTradeLicense] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  // Step 2
  const [currencyCode, setCurrencyCode] = useState(tenant?.currency_code || 'BDT');
  const [timezone, setTimezone] = useState(tenant?.timezone || 'Asia/Dhaka');
  const [fiscalYearStart, setFiscalYearStart] = useState('July');
  // Step 3
  const [warehouseName, setWarehouseName] = useState('Main Central Warehouse');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [posCounterName, setPosCounterName] = useState('Main Cash Counter 01');
  // Step 4
  const [selectedIndustry, setSelectedIndustry] = useState('general_manufacturing');
  const [businessTypes, setBusinessTypes] = useState<string[]>(['manufacturing', 'wholesale']);
  const [manufacturingType, setManufacturingType] = useState('discrete');
  // Step 5
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'production', 'inventory', 'purchasing', 'sales', 'pos', 'ecommerce', 'delivery', 'finance', 'assets', 'hr', 'qc', 'reports',
  ]);
  const [productionStages, setProductionStages] = useState<ProductionStageConfig[]>([
    { key: 'material_prep', label: 'Material Preparation', sort_order: 1, is_qc_stage: false },
    { key: 'assembly', label: 'Assembly & Processing', sort_order: 2, is_qc_stage: false },
    { key: 'qc_inspection', label: 'Quality Control', sort_order: 3, is_qc_stage: true },
    { key: 'packaging', label: 'Packaging & Boxing', sort_order: 4, is_qc_stage: false },
  ]);
  // Step 6
  const [selectedUnits, setSelectedUnits] = useState<string[]>(['PCS', 'KG', 'BOX', 'PACK']);
  const [brandColor, setBrandColor] = useState('#6366f1');
  const [logoUrl, setLogoUrl] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState(
    '1. Goods received in sound condition.\n2. Invoices due within standard net payment terms.\n3. Authorized computer-generated commercial document.'
  );

  // Fetch saved state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.get<{
      success: boolean;
      data: {
        name?: string; company_legal_name?: string; trade_license?: string; tax_number?: string;
        address?: string; phone?: string; email?: string; currency_code?: string; timezone?: string;
        warehouse_name?: string; warehouse_address?: string; pos_counter_name?: string;
        business_type_keys?: string[]; industry_profile_key?: string; manufacturing_type?: string;
        brand_color?: string; logo_url?: string; invoice_terms?: string; units?: string[];
        onboarding_step?: number;
      };
    }>('/tenant/onboarding/state')
      .then((res) => {
        if (!active) return;
        const d = res.data?.data;
        if (!d) return;
        if (d.name) setCompanyName(String(d.name));
        if (d.company_legal_name) setCompanyLegalName(String(d.company_legal_name));
        if (d.trade_license) setTradeLicense(String(d.trade_license));
        if (d.tax_number) setTaxNumber(String(d.tax_number));
        if (d.address) { setRegisteredAddress(String(d.address)); setWarehouseAddress(String(d.address)); }
        if (d.phone) setOfficialPhone(String(d.phone));
        if (d.email) setOfficialEmail(String(d.email));
        if (d.currency_code) setCurrencyCode(String(d.currency_code));
        if (d.timezone) setTimezone(String(d.timezone));
        if (d.warehouse_name) setWarehouseName(String(d.warehouse_name));
        if (d.warehouse_address) setWarehouseAddress(String(d.warehouse_address));
        if (d.pos_counter_name) setPosCounterName(String(d.pos_counter_name));
        if (Array.isArray(d.business_type_keys)) setBusinessTypes(d.business_type_keys);
        if (d.industry_profile_key) setSelectedIndustry(String(d.industry_profile_key));
        if (d.manufacturing_type) setManufacturingType(String(d.manufacturing_type));
        if (d.brand_color) setBrandColor(String(d.brand_color));
        if (d.logo_url) setLogoUrl(String(d.logo_url));
        if (d.invoice_terms) setInvoiceTerms(String(d.invoice_terms));
        if (Array.isArray(d.units)) setSelectedUnits(d.units);
        if (typeof d.onboarding_step === 'number' && d.onboarding_step > 1) {
          const done: number[] = [];
          for (let s = 1; s < d.onboarding_step; s++) done.push(s);
          setCompletedSteps(done);
          setCurrentStep(initialStep > 1 ? initialStep : d.onboarding_step);
        }
      })
      .catch(() => { /* Use defaults — non-blocking */ })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, initialStep]);

  // Focus close button on open
  useEffect(() => {
    if (isOpen) setTimeout(() => closeRef.current?.focus(), 80);
  }, [isOpen]);

  // Escape to close & Focus trap via document listener (avoids non-native interactive div a11y defect)
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Live score
  const liveScore = useMemo(() => {
    let s = 0;
    if (companyName.trim() && (companyLegalName.trim() || taxNumber.trim() || registeredAddress.trim())) s += 20;
    if (currencyCode.trim() && timezone.trim()) s += 15;
    if (warehouseName.trim()) s += 15;
    if (selectedIndustry.trim() && businessTypes.length > 0) s += 15;
    if (enabledModules.length > 0 && productionStages.length > 0) s += 20;
    if (selectedUnits.length > 0 && invoiceTerms.trim()) s += 15;
    return Math.min(100, s);
  }, [companyName, companyLegalName, taxNumber, registeredAddress, currencyCode, timezone, warehouseName, selectedIndustry, businessTypes, enabledModules, productionStages, selectedUnits, invoiceTerms]);

  const buildPayload = useCallback(() => ({
    company_name: companyName, company_legal_name: companyLegalName, trade_license: tradeLicense,
    tax_number: taxNumber, address: registeredAddress, phone: officialPhone, email: officialEmail,
    currency_code: currencyCode, timezone, fiscal_year_start: fiscalYearStart,
    warehouse_name: warehouseName, warehouse_address: warehouseAddress || registeredAddress,
    pos_counter_name: posCounterName, business_type_keys: businessTypes,
    industry_profile_key: selectedIndustry, manufacturing_type: manufacturingType,
    enabled_modules: enabledModules, production_stages: productionStages,
    units: selectedUnits, brand_color: brandColor, logo_url: logoUrl, invoice_terms: invoiceTerms,
  }), [
    companyName, companyLegalName, tradeLicense, taxNumber, registeredAddress, officialPhone,
    officialEmail, currencyCode, timezone, fiscalYearStart, warehouseName, warehouseAddress,
    posCounterName, businessTypes, selectedIndustry, manufacturingType, enabledModules,
    productionStages, selectedUnits, brandColor, logoUrl, invoiceTerms,
  ]);

  const handleNext = async () => {
    setSubmitting(true);
    try {
      await api.post('/tenant/onboarding/step', { step: currentStep, data: buildPayload() });
      const name = (companyName || companyLegalName || '').trim();
      if (name) {
        try {
          localStorage.setItem('company_name', name);
          window.dispatchEvent(new CustomEvent('tenant_branding_updated', { detail: { name } }));
        } catch { /* ignore */ }
      }
      setCompletedSteps((p) => p.includes(currentStep) ? p : [...p, currentStep]);
      setDirection(1);
      setCurrentStep((p) => p + 1);
    } catch {
      notify.error('Failed to save step. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) { setDirection(-1); setCurrentStep((p) => p - 1); }
  };

  const handleJumpToStep = (stepId: number) => {
    if (completedSteps.includes(stepId) || stepId === currentStep) {
      setDirection(stepId > currentStep ? 1 : -1);
      setCurrentStep(stepId);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await api.post('/tenant/onboarding/complete', buildPayload());
      const name = (companyName || companyLegalName || '').trim();
      if (name) {
        try {
          localStorage.setItem('company_name', name);
          window.dispatchEvent(new CustomEvent('tenant_branding_updated', { detail: { name } }));
        } catch { /* ignore */ }
      }
      try { localStorage.setItem('erp_onboarding_completed', 'true'); } catch { /* ignore */ }
      await invalidateManifest();
      await bootstrapManifest(true);
      notify.success('Workspace initialized with 100% profile score!');
      onClose();
      navigate('/dashboard');
    } catch {
      notify.error('Failed to finalize onboarding. Please check inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyIndustryProfile = (profile: IndustryProfileTemplate) => {
    setSelectedIndustry(profile.key);
    if (profile.business_type_keys) setBusinessTypes(profile.business_type_keys);
    if (profile.recommended_modules) setEnabledModules(profile.recommended_modules);
    if (profile.default_production_stages) setProductionStages(profile.default_production_stages);
    if (profile.default_units) setSelectedUnits(profile.default_units);
    notify.info(`Industry blueprint '${profile.label}' applied.`);
  };

  const stepData = WIZARD_STEPS[currentStep - 1]!;
  const StepIcon = stepData.icon;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Scrim — the only glass treatment in the modal */}
            <m.div
              key="owm-scrim"
              variants={scrimVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed inset-0 z-[var(--z-overlay)] bg-black/60 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Panel wrapper — centers, handles keydown, pointer-events */}
            <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <m.div
                key="owm-panel"
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-5xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl border border-default/70 flex flex-col overflow-hidden pointer-events-auto"
              >
                {/* ── Top bar ─────────────────────────────────────────── */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-default/60 bg-surface-sunken/40 shrink-0">
                  {/* Step counter */}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                    Step {currentStep} of {WIZARD_STEPS.length}
                  </span>

                  {/* 6-segment track — fills only on step save, no pulse */}
                  <div className="flex-1 grid grid-cols-6 gap-1">
                    {WIZARD_STEPS.map((step) => {
                      const done = completedSteps.includes(step.id);
                      const active = step.id === currentStep && !done;
                      return (
                        <div
                          key={step.id}
                          className={`h-1.5 rounded-full transition-colors duration-300 ${done ? 'bg-success' : active ? 'bg-primary' : 'bg-default/20'}`}
                          title={`${step.title}: ${done ? 'Completed' : active ? 'In Progress' : 'Pending'}`}
                        />
                      );
                    })}
                  </div>

                  {/* Live score */}
                  <span className="text-[11px] font-mono font-bold text-primary shrink-0">{liveScore}%</span>

                  {/* Close */}
                  <button
                    ref={closeRef}
                    type="button"
                    id={`${modalId}-close`}
                    onClick={onClose}
                    className="flex items-center justify-center size-7 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    title="Close wizard (progress is saved per step)"
                    aria-label="Close setup wizard"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* ── Body: sidebar + content ──────────────────────────── */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  {/* Sidebar — visible md+ */}
                  <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-default/60 bg-surface-sunken overflow-y-auto">
                    {/* Brand header */}
                    <div className="px-4 py-5 border-b border-default/50">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-fg shrink-0">
                          <Layers className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-default leading-tight truncate">Workspace Setup</div>
                          <div className="text-[10px] text-muted truncate">{tenant?.name || 'Your workspace'}</div>
                        </div>
                      </div>
                      {/* Completion strip */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted">{completedSteps.length} of {WIZARD_STEPS.length} complete</span>
                          <span className="font-mono font-bold text-primary">{liveScore}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-default/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all duration-300"
                            style={{ width: `${Math.max(0, (completedSteps.length / WIZARD_STEPS.length) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step nav */}
                    <nav aria-label="Setup steps" className="flex-1 p-2 space-y-0.5">
                      {WIZARD_STEPS.map((step) => (
                        <StepNavItem
                          key={step.id}
                          step={step}
                          isCompleted={completedSteps.includes(step.id)}
                          isActive={step.id === currentStep}
                          onClick={() => handleJumpToStep(step.id)}
                        />
                      ))}
                    </nav>
                  </aside>

                  {/* Content panel */}
                  <main className="flex-1 flex flex-col min-h-0 min-w-0">
                    {loading ? (
                      /* Loading state */
                      <div className="flex flex-1 items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="size-8 animate-spin text-primary" />
                          <p className="text-xs text-muted">Loading your workspace configuration…</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Step header */}
                        <div className="px-6 pt-6 pb-4 border-b border-default/50 shrink-0">
                          <div className="flex items-start gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
                              <StepIcon className="size-5" />
                            </div>
                            <div>
                              <span className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest">
                                Step {currentStep}
                              </span>
                              <h2 id={titleId} className="text-lg font-bold text-default leading-tight">
                                {stepData.title}
                              </h2>
                              <p className="text-xs text-muted mt-0.5">{stepData.subtitle}</p>
                            </div>
                          </div>
                        </div>

                        {/* Animated step content */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0 scrollbar-thin scrollbar-thumb-default/30">
                          <AnimatePresence mode="wait" custom={direction}>
                            <m.div key={currentStep} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                              {currentStep === 1 && (
                                <Step1
                                  companyName={companyName} setCompanyName={setCompanyName}
                                  companyLegalName={companyLegalName} setCompanyLegalName={setCompanyLegalName}
                                  tradeLicense={tradeLicense} setTradeLicense={setTradeLicense}
                                  taxNumber={taxNumber} setTaxNumber={setTaxNumber}
                                  registeredAddress={registeredAddress} setRegisteredAddress={setRegisteredAddress}
                                  officialPhone={officialPhone} setOfficialPhone={setOfficialPhone}
                                  officialEmail={officialEmail} setOfficialEmail={setOfficialEmail}
                                  setWarehouseAddress={setWarehouseAddress}
                                />
                              )}
                              {currentStep === 2 && (
                                <Step2
                                  currencyCode={currencyCode} setCurrencyCode={setCurrencyCode}
                                  timezone={timezone} setTimezone={setTimezone}
                                  fiscalYearStart={fiscalYearStart} setFiscalYearStart={setFiscalYearStart}
                                />
                              )}
                              {currentStep === 3 && (
                                <Step3
                                  warehouseName={warehouseName} setWarehouseName={setWarehouseName}
                                  warehouseAddress={warehouseAddress} setWarehouseAddress={setWarehouseAddress}
                                  posCounterName={posCounterName} setPosCounterName={setPosCounterName}
                                />
                              )}
                              {currentStep === 4 && (
                                <Step4
                                  selectedIndustry={selectedIndustry}
                                  businessTypes={businessTypes} setBusinessTypes={setBusinessTypes}
                                  manufacturingType={manufacturingType} setManufacturingType={setManufacturingType}
                                  onApplyProfile={handleApplyIndustryProfile}
                                />
                              )}
                              {currentStep === 5 && (
                                <Step5
                                  enabledModules={enabledModules} setEnabledModules={setEnabledModules}
                                  productionStages={productionStages} setProductionStages={setProductionStages}
                                />
                              )}
                              {currentStep === 6 && (
                                <Step6
                                  selectedUnits={selectedUnits} setSelectedUnits={setSelectedUnits}
                                  brandColor={brandColor} setBrandColor={setBrandColor}
                                  logoUrl={logoUrl} setLogoUrl={setLogoUrl}
                                  invoiceTerms={invoiceTerms} setInvoiceTerms={setInvoiceTerms}
                                  warehouseName={warehouseName}
                                />
                              )}
                            </m.div>
                          </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-default/50 bg-surface-sunken/30 shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            {/* Back */}
                            {currentStep > 1 ? (
                              <Button variant="ghost" size="sm" onClick={handleBack} disabled={submitting}
                                className="flex items-center gap-1.5 text-xs">
                                <ArrowLeft className="size-3.5" /><span>Back</span>
                              </Button>
                            ) : <div />}

                            <div className="flex items-center gap-3">
                              {/* Save & close text link */}
                              <button type="button" onClick={onClose}
                                className="text-xs text-muted hover:text-default transition-colors cursor-pointer hidden sm:block">
                                Save & close
                              </button>

                              {/* Primary CTA */}
                              {currentStep < WIZARD_STEPS.length ? (
                                <Button variant="primary" size="md" onClick={handleNext}
                                  loading={submitting} loadingLabel="Saving…"
                                  disabled={submitting}
                                  className="flex items-center gap-1.5 min-h-[38px] px-5">
                                  <span>Save & Continue</span>
                                  <ArrowRight className="size-3.5" />
                                </Button>
                              ) : (
                                <Button variant="primary" size="md" onClick={handleComplete}
                                  loading={submitting} loadingLabel="Initializing workspace…"
                                  disabled={submitting}
                                  className="flex items-center gap-2 min-h-[38px] px-5 bg-success hover:bg-success/90">
                                  <Rocket className="size-4" />
                                  <span>{submitting ? 'Initializing…' : 'Provision Workspace & Launch'}</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Mobile step dots */}
                          <div className="flex items-center justify-center gap-1 mt-3 md:hidden" aria-hidden="true">
                            {WIZARD_STEPS.map((step) => (
                              <div key={step.id} className={`rounded-full transition-all duration-300 ${
                                step.id === currentStep ? 'w-4 h-1.5 bg-primary'
                                : completedSteps.includes(step.id) ? 'w-1.5 h-1.5 bg-success'
                                : 'w-1.5 h-1.5 bg-default/20'
                              }`} />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </main>
                </div>
              </m.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
};

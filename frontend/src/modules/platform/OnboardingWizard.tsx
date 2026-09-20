import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { useAuthStore } from '../../lib/auth/authStore';
import { Button } from '../../components/ui/Button';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { notify } from '../../components/ui/Toast';
import { IndustryProfilePicker } from './IndustryProfilePicker';
import {
  ArrowRight,
  ArrowLeft,
  Layers,
  Rocket,
  RefreshCw,
  Trash2,
  Plus,
  Building2,
  Coins,
  Warehouse,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { IndustryProfileTemplate, ProductionStageConfig } from '../../lib/capabilities/types';

const STEPS = [
  { id: 1, title: 'Legal Identity & Tax', desc: 'Company name, Trade License, VAT/TIN, Registered Office' },
  { id: 2, title: 'Financial Localization', desc: 'Operating Currency, Timezone & Fiscal Calendar' },
  { id: 3, title: 'Facilities & Warehousing', desc: 'Central Factory Warehouse, Physical Depot & POS Counter' },
  { id: 4, title: 'Industry Blueprint', desc: 'Sector Template & Manufacturing Model' },
  { id: 5, title: 'Subsystems & Floor Stages', desc: 'Active Modules & Sequential Routing Gates' },
  { id: 6, title: 'Standards, Branding & Launch', desc: 'Units of Measure, Invoicing Terms, Brand Theme & 100% Graduation' },
];

const BUSINESS_MODELS = [
  { key: 'manufacturing', label: 'Manufacturing & Processing', desc: 'Produce goods from raw materials with BOM & stages.' },
  { key: 'wholesale', label: 'Wholesale & B2B Distribution', desc: 'Bulk supply to dealers, supermarkets, and corporate buyers.' },
  { key: 'retail', label: 'Retail & POS Outlets', desc: 'Physical showroom counters with fast POS barcode checkout.' },
  { key: 'ecommerce', label: 'Direct E-Commerce', desc: 'Online storefront with delivery tracking.' },
  { key: 'trading', label: 'Trading & Brokering', desc: 'Procure and fulfill without factory manufacturing.' },
];

const MANUFACTURING_TYPES = [
  { key: 'discrete', label: 'Discrete Manufacturing', desc: 'Countable items (garments, furniture, electronics, auto parts, appliances).' },
  { key: 'process', label: 'Process / Recipe Manufacturing', desc: 'Liquid or bulk batch blending (food, beverages, chemicals, paints, pharma).' },
  { key: 'job_shop', label: 'Job Shop & Custom Build', desc: 'Made-to-order custom fabrication and bespoke prototyping.' },
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

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const invalidateManifest = useTenantCapabilityStore((state) => state.invalidate);
  const bootstrapManifest = useTenantCapabilityStore((state) => state.bootstrap);
  const tenant = useAuthStore((state) => state.tenant);

  // Step 1: Legal & Company Identity
  const [companyName, setCompanyName] = useState(tenant?.name || '');
  const [companyLegalName, setCompanyLegalName] = useState(tenant?.name || '');
  const [tradeLicense, setTradeLicense] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');

  // Step 2: Financial & Localization
  const [currencyCode, setCurrencyCode] = useState(tenant?.currency_code || 'BDT');
  const [timezone, setTimezone] = useState(tenant?.timezone || 'Asia/Dhaka');
  const [fiscalYearStart, setFiscalYearStart] = useState('July');

  // Step 3: Operational Facilities
  const [warehouseName, setWarehouseName] = useState('Main Central Warehouse');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [posCounterName, setPosCounterName] = useState('Main Cash Counter 01');

  // Step 4: Blueprint & Business Model
  const [selectedIndustry, setSelectedIndustry] = useState<string>('general_manufacturing');
  const [businessTypes, setBusinessTypes] = useState<string[]>(['manufacturing', 'wholesale']);
  const [manufacturingType, setManufacturingType] = useState('discrete');

  // Step 5: Modules & Stages
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'production', 'inventory', 'purchasing', 'sales', 'pos', 'ecommerce', 'delivery', 'finance', 'assets', 'hr', 'qc', 'reports'
  ]);
  const [productionStages, setProductionStages] = useState<ProductionStageConfig[]>([
    { key: 'material_prep', label: 'Material Preparation', sort_order: 1, is_qc_stage: false },
    { key: 'assembly', label: 'Assembly & Processing', sort_order: 2, is_qc_stage: false },
    { key: 'qc_inspection', label: 'Quality Control', sort_order: 3, is_qc_stage: true },
    { key: 'packaging', label: 'Packaging & Boxing', sort_order: 4, is_qc_stage: false },
  ]);

  // Step 6: Standards & Branding
  const [selectedUnits, setSelectedUnits] = useState<string[]>(['PCS', 'KG', 'BOX', 'PACK']);
  const [brandColor, setBrandColor] = useState('#6366f1');
  const [logoUrl, setLogoUrl] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState(
    '1. Goods received in sound condition.\n2. Invoices due within standard net payment terms.\n3. Authorized computer-generated commercial document.'
  );

  // Fetch existing state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data: {
            name?: string;
            company_legal_name?: string;
            trade_license?: string;
            tax_number?: string;
            address?: string;
            phone?: string;
            email?: string;
            currency_code?: string;
            timezone?: string;
            warehouse_name?: string;
            warehouse_address?: string;
            pos_counter_name?: string;
            business_type_keys?: string[];
            industry_profile_key?: string;
            manufacturing_type?: string;
            brand_color?: string;
            logo_url?: string;
            invoice_terms?: string;
            units?: string[];
            onboarding_step?: number;
          };
        }>('/tenant/onboarding/state');

        if (res.data?.data) {
          const d = res.data.data;
          if (d.name) setCompanyName(String(d.name));
          if (d.company_legal_name) setCompanyLegalName(String(d.company_legal_name));
          if (d.trade_license) setTradeLicense(String(d.trade_license));
          if (d.tax_number) setTaxNumber(String(d.tax_number));
          if (d.address) {
            setRegisteredAddress(String(d.address));
            setWarehouseAddress(String(d.address));
          }
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

          if (typeof d.onboarding_step === 'number' && d.onboarding_step > 1 && d.onboarding_step <= 6) {
            setCurrentStep(d.onboarding_step);
          }
        }
      } catch {
        // Fallback to initial defaults
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, []);

  // Calculate live completion score
  const liveCompletionPercentage = useMemo(() => {
    let score = 0;
    // Step 1: Legal Identity & Tax (20%)
    if (companyName.trim() && (companyLegalName.trim() || taxNumber.trim() || registeredAddress.trim())) {
      score += 20;
    }
    // Step 2: Financial (15%)
    if (currencyCode.trim() && timezone.trim()) {
      score += 15;
    }
    // Step 3: Warehouse Facilities (15%)
    if (warehouseName.trim()) {
      score += 15;
    }
    // Step 4: Blueprint (15%)
    if (selectedIndustry.trim() && businessTypes.length > 0) {
      score += 15;
    }
    // Step 5: Modules & Stages (20%)
    if (enabledModules.length > 0 && productionStages.length > 0) {
      score += 20;
    }
    // Step 6: Standards & Branding (15%)
    if (selectedUnits.length > 0 && invoiceTerms.trim()) {
      score += 15;
    }
    return Math.min(100, score);
  }, [
    companyName,
    companyLegalName,
    taxNumber,
    registeredAddress,
    currencyCode,
    timezone,
    warehouseName,
    selectedIndustry,
    businessTypes,
    enabledModules,
    productionStages,
    selectedUnits,
    invoiceTerms,
  ]);

  const handleApplyIndustryProfile = (profile: IndustryProfileTemplate) => {
    setSelectedIndustry(profile.key);
    if (profile.business_type_keys) setBusinessTypes(profile.business_type_keys);
    if (profile.recommended_modules) setEnabledModules(profile.recommended_modules);
    if (profile.default_production_stages) setProductionStages(profile.default_production_stages);
    if (profile.default_units) setSelectedUnits(profile.default_units);
    notify.info(`Industry blueprint '${profile.label}' applied.`);
  };

  const handleNext = async () => {
    // Save current step progress to backend
    try {
      await api.post('/tenant/onboarding/step', {
        step: currentStep,
        data: {
          company_name: companyName,
          company_legal_name: companyLegalName,
          trade_license: tradeLicense,
          tax_number: taxNumber,
          address: registeredAddress,
          phone: officialPhone,
          email: officialEmail,
          currency_code: currencyCode,
          timezone,
          fiscal_year_start: fiscalYearStart,
          warehouse_name: warehouseName,
          warehouse_address: warehouseAddress || registeredAddress,
          pos_counter_name: posCounterName,
          business_type_keys: businessTypes,
          industry_profile_key: selectedIndustry,
          manufacturing_type: manufacturingType,
          enabled_modules: enabledModules,
          production_stages: productionStages,
          units: selectedUnits,
          brand_color: brandColor,
          logo_url: logoUrl,
          invoice_terms: invoiceTerms,
        },
      });
      const chosenName = (companyName || companyLegalName || '').trim();
      if (chosenName) {
        try {
          localStorage.setItem('company_name', chosenName);
          window.dispatchEvent(new CustomEvent('tenant_branding_updated', { detail: { name: chosenName } }));
        } catch {}
      }
    } catch {
      // Non-blocking
    }

    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await api.post('/tenant/onboarding/complete', {
        company_name: companyName,
        company_legal_name: companyLegalName,
        trade_license: tradeLicense,
        tax_number: taxNumber,
        address: registeredAddress,
        phone: officialPhone,
        email: officialEmail,
        currency_code: currencyCode,
        timezone,
        fiscal_year_start: fiscalYearStart,
        warehouse_name: warehouseName,
        warehouse_address: warehouseAddress || registeredAddress,
        pos_counter_name: posCounterName,
        business_type_keys: businessTypes,
        industry_profile_key: selectedIndustry,
        manufacturing_type: manufacturingType,
        enabled_modules: enabledModules,
        production_stages: productionStages,
        units: selectedUnits,
        brand_color: brandColor,
        logo_url: logoUrl,
        invoice_terms: invoiceTerms,
      });

      const chosenName = (companyName || companyLegalName || '').trim();
      if (chosenName) {
        try {
          localStorage.setItem('company_name', chosenName);
          window.dispatchEvent(new CustomEvent('tenant_branding_updated', { detail: { name: chosenName } }));
        } catch {}
      }

      await invalidateManifest();
      await bootstrapManifest(true);
      notify.success('🎉 Workspace initialized with 100% profile score!');
      navigate('/dashboard');
    } catch {
      notify.error('Failed to finalize onboarding. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCw className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-default py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Sticky Header with 0-100% Progress Bar */}
        <div className="rounded-2xl border border-default bg-surface p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-md">
                <Layers className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-default">
                  ERP Workspace Setup Wizard
                </h1>
                <p className="text-xs text-muted">
                  Setup foundational data and operational parameters (Step {currentStep} of 6)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-muted">Profile Score</div>
                <div className="text-base font-bold font-mono text-primary">
                  {liveCompletionPercentage}%
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-xs text-muted hover:text-default"
                title="Save progress and return to dashboard"
              >
                Skip to Dashboard
              </Button>
            </div>
          </div>

          {/* Progress Track */}
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised border border-default/40">
              <div
                className="h-full bg-linear-to-r from-indigo-500 via-primary to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.max(5, liveCompletionPercentage)}%` }}
              />
            </div>
          </div>

          {/* Step Pills */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 border-t border-default/40 text-xs">
            {STEPS.map((s) => {
              const isCurrent = s.id === currentStep;
              const isPassed = s.id < currentStep;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex flex-col text-left rounded-lg p-2 transition-all ${
                    isCurrent
                      ? 'border border-primary bg-primary/10 text-primary font-semibold'
                      : isPassed
                      ? 'text-emerald-600 dark:text-emerald-400 bg-surface-sunken'
                      : 'text-muted hover:bg-surface-sunken'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10px]">
                    {isPassed ? (
                      <CheckCircle2 className="size-3 text-emerald-500" />
                    ) : (
                      <span>#{s.id}</span>
                    )}
                    <span className="truncate">{s.title.split(' ')[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Main Card */}
        <div className="rounded-2xl border border-default bg-surface p-6 shadow-sm space-y-6">
          {/* Step 1: Legal Identity & Tax */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-default">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-default">Company & Legal Identity</h2>
                  <p className="text-xs text-muted">Legal registrations, tax IDs, and registered corporate premises.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Operating Brand Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Manufacturing Ltd"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Registered Legal Entity Name *
                  </label>
                  <input
                    type="text"
                    value={companyLegalName}
                    onChange={(e) => setCompanyLegalName(e.target.value)}
                    placeholder="e.g. Apex Industrial Holdings Incorporated"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Trade License Number
                  </label>
                  <input
                    type="text"
                    value={tradeLicense}
                    onChange={(e) => setTradeLicense(e.target.value)}
                    placeholder="e.g. TRAD/DNCC/012948/2026"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Tax ID / VAT Registration / BIN *
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="e.g. BIN-002849182-0102"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Registered Corporate Address *
                  </label>
                  <textarea
                    rows={2}
                    value={registeredAddress}
                    onChange={(e) => {
                      setRegisteredAddress(e.target.value);
                      if (!warehouseAddress) setWarehouseAddress(e.target.value);
                    }}
                    placeholder="e.g. Plot 42, Sector 7, Export Processing Zone, Dhaka 1230"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Official Support Phone
                  </label>
                  <input
                    type="text"
                    value={officialPhone}
                    onChange={(e) => setOfficialPhone(e.target.value)}
                    placeholder="e.g. +880 2 9876543"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Official Accounts / Billing Email
                  </label>
                  <input
                    type="email"
                    value={officialEmail}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    placeholder="e.g. accounts@apexholdings.com"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Financial Localization */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-default">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Coins className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-default">Financial & Regional Localization</h2>
                  <p className="text-xs text-muted">Operating base currency, timezone for audit timestamps, and fiscal periods.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Operating Base Currency *
                  </label>
                  <SelectDropdown
                    options={[
                      { value: 'BDT', label: 'BDT (৳) - Bangladeshi Taka' },
                      { value: 'USD', label: 'USD ($) - US Dollar' },
                      { value: 'EUR', label: 'EUR (€) - Euro' },
                      { value: 'GBP', label: 'GBP (£) - British Pound' },
                      { value: 'AED', label: 'AED (د.إ) - UAE Dirham' },
                      { value: 'SAR', label: 'SAR (﷼) - Saudi Riyal' },
                      { value: 'INR', label: 'INR (₹) - Indian Rupee' },
                    ]}
                    value={currencyCode}
                    onChange={(val) => setCurrencyCode(val)}
                  />
                  <p className="text-[11px] text-muted mt-1">Defines accounting ledger valuation and default sales pricing.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Operating Timezone *
                  </label>
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
                    onChange={(val) => setTimezone(val)}
                  />
                  <p className="text-[11px] text-muted mt-1">Times used for batch logs, shifts, and timestamps.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Fiscal Year Start
                  </label>
                  <SelectDropdown
                    options={[
                      { value: 'July', label: 'July (Standard BD/AU)' },
                      { value: 'January', label: 'January (Calendar Year)' },
                      { value: 'April', label: 'April (Standard UK/IN)' },
                    ]}
                    value={fiscalYearStart}
                    onChange={(val) => setFiscalYearStart(val)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Operational Facilities & Warehouses */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-default">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Warehouse className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-default">Operational Facilities & Storage</h2>
                  <p className="text-xs text-muted">Primary physical inventory depot and POS sales register.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Primary Central Warehouse / Depot Name *
                  </label>
                  <input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="e.g. Main Factory Central Warehouse"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-muted mt-1">Where initial raw materials and finished goods are stocked.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Default POS Cash Counter / Outlet Name
                  </label>
                  <input
                    type="text"
                    value={posCounterName}
                    onChange={(e) => setPosCounterName(e.target.value)}
                    placeholder="e.g. Main Showroom Register 01"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Facility Physical Location / Address
                  </label>
                  <input
                    type="text"
                    value={warehouseAddress}
                    onChange={(e) => setWarehouseAddress(e.target.value)}
                    placeholder="e.g. Industrial Shed B-4, Storage Zone 1"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Industry Blueprint & Business Model */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-default">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Layers className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-default">Industry Blueprint & Business Model</h2>
                  <p className="text-xs text-muted">Select your sector to automatically configure modules, stages, and nomenclature.</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Choose Industry Blueprint Preset
                </label>
                <IndustryProfilePicker
                  selectedKey={selectedIndustry}
                  onSelect={handleApplyIndustryProfile}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-default">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Business Operation Channels
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUSINESS_MODELS.map((bm) => {
                    const isChecked = businessTypes.includes(bm.key);
                    return (
                      <label
                        key={bm.key}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                          isChecked ? 'border-primary bg-primary/5' : 'border-default bg-surface-sunken'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBusinessTypes([...businessTypes, bm.key]);
                            } else {
                              setBusinessTypes(businessTypes.filter((k) => k !== bm.key));
                            }
                          }}
                          className="mt-0.5 rounded border-default text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="text-xs font-semibold text-default">{bm.label}</div>
                          <div className="text-[11px] text-muted">{bm.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-default">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Manufacturing Flow Structure
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {MANUFACTURING_TYPES.map((mt) => {
                    const isSelected = manufacturingType === mt.key;
                    return (
                      <button
                        key={mt.key}
                        type="button"
                        onClick={() => setManufacturingType(mt.key)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-default bg-surface-sunken text-default'
                        }`}
                      >
                        <div className="text-xs font-semibold">{mt.label}</div>
                        <div className="text-[11px] text-muted mt-1 leading-snug">{mt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Subsystems & Production Stages */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-default">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-default">Subsystems & Production Floor Stages</h2>
                  <p className="text-xs text-muted">Activate departmental modules and configure sequential routing stages.</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                  Active Departmental Subsystems
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_MODULES.map((m) => {
                    const isEnabled = enabledModules.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${
                          isEnabled ? 'border-primary bg-primary/5 font-semibold text-default' : 'border-default text-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEnabledModules([...enabledModules, m.key]);
                            } else {
                              setEnabledModules(enabledModules.filter((k) => k !== m.key));
                            }
                          }}
                          className="rounded border-default text-primary focus:ring-primary"
                        />
                        <span className="truncate text-[11px]">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-default space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Production Floor Routing Stages
                    </label>
                    <p className="text-[11px] text-muted">Sequential steps required before output is stocked in warehouse.</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nextOrder = productionStages.length + 1;
                      setProductionStages([
                        ...productionStages,
                        {
                          key: `stage_${nextOrder}`,
                          label: `Custom Stage ${nextOrder}`,
                          sort_order: nextOrder,
                          is_qc_stage: false,
                        },
                      ]);
                    }}
                    className="text-xs flex items-center gap-1"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Stage</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  {productionStages.map((stage, idx) => (
                    <div
                      key={stage.key}
                      className="flex items-center gap-3 rounded-xl border border-default bg-surface-sunken p-3 text-xs"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={stage.label}
                        onChange={(e) => {
                          const updated = [...productionStages];
                          updated[idx] = { ...stage, label: e.target.value };
                          setProductionStages(updated);
                        }}
                        className="flex-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={stage.is_qc_stage}
                          onChange={(e) => {
                            const updated = [...productionStages];
                            updated[idx] = { ...stage, is_qc_stage: e.target.checked };
                            setProductionStages(updated);
                          }}
                          className="rounded border-default text-primary"
                        />
                        <span>QC Gate</span>
                      </label>
                      {productionStages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProductionStages(productionStages.filter((_, i) => i !== idx))}
                          className="text-muted hover:text-rose-500 p-1"
                          title="Remove stage"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Standards, Branding & Launch */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-default">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-default">Measurement Standards & Invoicing Branding</h2>
                  <p className="text-xs text-muted">Baseline Units of Measure (UoMs), brand accents, and invoice print terms.</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                  Active Units of Measure (UoM) *
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_UNITS.map((u) => {
                    const isSelected = selectedUnits.includes(u);
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedUnits.length > 1) setSelectedUnits(selectedUnits.filter((item) => item !== u));
                          } else {
                            setSelectedUnits([...selectedUnits, u]);
                          }
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-default bg-surface-sunken text-muted hover:text-default'
                        }`}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-default">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Primary Brand Theme Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="size-9 rounded-lg border border-default bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="flex-1 rounded-xl border border-default bg-surface-sunken p-2 text-xs font-mono text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Brand Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://your-domain.com/logo.png"
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Official Invoicing Terms & Delivery Challan Notice
                  </label>
                  <textarea
                    rows={3}
                    value={invoiceTerms}
                    onChange={(e) => setInvoiceTerms(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* 100% Graduation Verification Box */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="size-4" />
                  <span>Ready for 100% Workspace Graduation</span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Completing this setup will provision your default central warehouse ({warehouseName}), units of measure ({selectedUnits.join(', ')}), legal invoice headers, and production floor stages. You will graduate with 100% setup completion and the onboarding prompt will be retired.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-default">
            {currentStep > 1 ? (
              <Button
                variant="ghost"
                onClick={handlePrev}
                className="flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <Button
                variant="primary"
                onClick={handleNext}
                className="flex items-center gap-1.5 min-h-10"
              >
                <span>Save & Continue</span>
                <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleComplete}
                disabled={submitting}
                className="flex items-center gap-2 min-h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Rocket className="size-4" />
                <span>{submitting ? 'Initializing...' : 'Provision Workspace & Launch ERP (100%)'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

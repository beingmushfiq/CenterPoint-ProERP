// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS IDENTITY TAB — Document Branding & Company Legal Profile
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Save,
  FileText,
  Phone,
  BadgePercent,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../../../lib/api/client';
import type { BusinessConfig } from '../../../../lib/document/useBusinessConfig';

const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  name: '',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  vatNumber: '',
  tinNumber: '',
  tradeLicense: '',
  currencySymbol: '৳',
  currencyCode: 'BDT',
  invoiceTerms: '',
  signaturePreparedBy: 'Prepared By (Billing Desk)',
  signatureCheckedBy: 'Verified By (Accounts & Audit)',
  signatureAuthorized: 'Authorized Representative',
  signatureReceiver: 'Customer Acknowledgement',
};

export function BusinessIdentityTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BusinessConfig>(DEFAULT_BUSINESS_CONFIG);
  const [saving, setSaving] = useState(false);

  const { data: serverConfig, isLoading, isFetching, refetch } = useQuery<Partial<BusinessConfig>>({
    queryKey: ['settings', 'company'],
    queryFn: async () => {
      try {
        const res = await api.get<Partial<BusinessConfig>>('/settings/company');
        if (res.data) {
          return res.data;
        }
      } catch {
        // Fallback
      }
      return {};
    },
  });

  useEffect(() => {
    if (serverConfig && Object.keys(serverConfig).length > 0) {
      const timer = setTimeout(() => {
        setForm((prev) => ({ ...prev, ...serverConfig }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [serverConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company legal name is required');
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings/company', form);
      toast.success('Business identity & document branding saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
    } catch {
      toast.error('Failed to save business settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof BusinessConfig, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return <div className="py-12 text-center text-xs text-muted">Loading business identity profile...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-default">
        <div>
          <h3 className="text-base font-bold text-default tracking-tight">Business Identity & Branding</h3>
          <p className="text-xs text-muted">
            Authoritative company header details, registration numbers, tax credentials, and default legal terms applied to all printed commercial vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-muted hover:text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors cursor-pointer"
            title="Refresh Business Profile"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-sm transition-all cursor-pointer"
          >
            <Save className="size-4" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Legal Profile */}
        <div className="p-4 rounded-2xl border border-default bg-surface space-y-4">
          <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-2">
            <Building2 className="size-3.5 text-primary" />
            <span>Commercial Identity</span>
          </h4>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Legal Business Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Apex Industrial Agro Foods Ltd."
              className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-medium focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              placeholder="e.g. Industrial Food Processing & Commercial Mill"
              className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Full Registered Office Address
            </label>
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="e.g. Plot 42, Tejgaon Industrial Area, Dhaka - 1208, Bangladesh"
              className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={form.currencySymbol}
                onChange={(e) => handleChange('currencySymbol', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Currency Code
              </label>
              <input
                type="text"
                value={form.currencyCode}
                onChange={(e) => handleChange('currencyCode', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Contact & Tax Identification */}
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-default bg-surface space-y-4">
            <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-2">
              <BadgePercent className="size-3.5 text-primary" />
              <span>Tax & Registration Numbers</span>
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                VAT Registration / BIN Number
              </label>
              <input
                type="text"
                value={form.vatNumber}
                onChange={(e) => handleChange('vatNumber', e.target.value)}
                placeholder="BIN: 001894523-0102"
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Tax Identification (TIN)
                </label>
                <input
                  type="text"
                  value={form.tinNumber}
                  onChange={(e) => handleChange('tinNumber', e.target.value)}
                  placeholder="TIN: 5412-8876-0091"
                  className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Trade License Number
                </label>
                <input
                  type="text"
                  value={form.tradeLicense}
                  onChange={(e) => handleChange('tradeLicense', e.target.value)}
                  placeholder="TRAD/DNCC/012948"
                  className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-mono focus:outline-hidden focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-default bg-surface space-y-4">
            <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-2">
              <Phone className="size-3.5 text-primary" />
              <span>Contact Information</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Official Phone
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+880 1800-000000"
                  className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="billing@company.com"
                  className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Official Website
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="www.company.com"
                className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Global Invoice Legal Terms */}
      <div className="p-4 rounded-2xl border border-default bg-surface space-y-3">
        <h4 className="text-xs font-bold text-default uppercase tracking-wider flex items-center gap-2">
          <FileText className="size-3.5 text-primary" />
          <span>Standard Document Legal Terms & Conditions</span>
        </h4>
        <p className="text-[11px] text-muted">
          Default terms and warranty declarations printed on standard tax invoices and receipts unless overridden by a template.
        </p>
        <textarea
          rows={4}
          value={form.invoiceTerms}
          onChange={(e) => handleChange('invoiceTerms', e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-surface-sunken border border-default text-default text-xs font-mono leading-relaxed focus:outline-hidden focus:border-primary"
        />
      </div>
    </form>
  );
}

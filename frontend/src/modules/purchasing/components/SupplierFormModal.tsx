import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  User,
  AlertCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { isApiError } from '../../../lib/api/errors';
import type { Party } from '../../../types/api/party';

export interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (supplier: Party) => void;
  supplier?: Party | null;
  quickMode?: boolean;
}

function getInitialSupplierFormData(supplier?: Party | null) {
  if (supplier) {
    const primaryAddress = supplier.addresses?.[0];
    const primaryContact = supplier.contacts?.[0];
    return {
      code: supplier.code || '',
      name: supplier.name || '',
      legal_name: supplier.legal_name || '',
      type: supplier.type || 'business',
      tax_identifier: supplier.tax_identifier || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      credit_limit: supplier.credit_limit || '0',
      credit_days: supplier.credit_days ?? 30,
      opening_balance: supplier.opening_balance || '0',
      status: supplier.status || 'active',
      contact_name: primaryContact?.name || '',
      line1: primaryAddress?.line1 || '',
      city: primaryAddress?.city || 'Dhaka',
      district: primaryAddress?.district || '',
      postal_code: primaryAddress?.postal_code || '',
    };
  }
  const rand = Math.floor(1000 + Math.random() * 9000);
  return {
    code: `SUP-${rand}`,
    name: '',
    legal_name: '',
    type: 'business',
    tax_identifier: '',
    phone: '',
    email: '',
    credit_limit: '0',
    credit_days: 30,
    opening_balance: '0',
    status: 'active',
    contact_name: '',
    line1: '',
    city: 'Dhaka',
    district: '',
    postal_code: '',
  };
}

const SupplierFormDialog: React.FC<SupplierFormModalProps> = ({
  onClose,
  onSuccess,
  supplier = null,
  quickMode = false,
}) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState(() => getInitialSupplierFormData(supplier));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Supplier company name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setErrorMessage('Supplier code is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: Record<string, unknown> = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        is_supplier: true,
        type: formData.type,
        status: formData.status,
      };

      if (formData.legal_name.trim()) payload.legal_name = formData.legal_name.trim();
      if (formData.tax_identifier.trim()) payload.tax_identifier = formData.tax_identifier.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.credit_limit) payload.credit_limit = parseFloat(formData.credit_limit) || 0;
      if (formData.credit_days !== undefined) payload.credit_days = Number(formData.credit_days);
      if (formData.opening_balance) payload.opening_balance = parseFloat(formData.opening_balance) || 0;

      // Address nested if provided
      if (formData.line1.trim() || formData.city.trim()) {
        payload.addresses = [
          {
            type: 'shipping',
            line1: formData.line1.trim() || 'Factory / Office Address',
            city: formData.city.trim() || 'Dhaka',
            district: formData.district.trim() || null,
            postal_code: formData.postal_code.trim() || null,
            country_code: 'BD',
            is_default: true,
            contact_name: formData.contact_name.trim() || null,
            phone: formData.phone.trim() || null,
          },
        ];
      }

      // Contact nested if provided
      if (formData.contact_name.trim()) {
        payload.contacts = [
          {
            name: formData.contact_name.trim(),
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            is_primary: true,
          },
        ];
      }

      let resData: Party;
      if (supplier) {
        const res = await api.patch<{ data: Party }>(`/parties/${supplier.id}`, payload);
        resData = res.data.data;
        toast.success(`Supplier "${resData.name}" updated successfully.`);
      } else {
        const res = await api.post<{ data: Party }>('/parties', payload);
        resData = res.data.data;
        toast.success(`Supplier "${resData.name}" registered successfully.`);
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['catalogue', 'parties'] });
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });

      onSuccess(resData);
      onClose();
    } catch (err: unknown) {
      if (isApiError(err)) {
        setErrorMessage(err.message || 'Failed to save supplier. Please check inputs.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-default px-6 py-4 bg-surface-raised/40">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-default">
                  {supplier ? 'Edit Supplier Profile' : quickMode ? 'Quick Add Supplier / Vendor' : 'New Supplier & Vendor'}
                </h3>
                {quickMode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="size-2.5" />
                    Quick Add
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {quickMode
                  ? 'Instantly create vendor credentials and link to your purchase order commitment'
                  : 'Maintain commercial vendor directory, trade terms, and contact records'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs flex-1">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Core Identification */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-default uppercase tracking-wider text-[11px]">
              <Building2 className="size-3.5 text-primary" />
              <span>Company Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-default mb-1">
                  Supplier / Company Name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delta Micro Electronics Ltd."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-xs sm:text-sm font-medium"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-default mb-1">
                  Vendor Code <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default font-mono focus:border-primary focus:outline-none text-xs sm:text-sm"
                  required
                />
              </div>
            </div>

            {!quickMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-muted mb-1">Legal Registered Name</label>
                  <input
                    type="text"
                    placeholder="Official legal entity name"
                    value={formData.legal_name}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Tax ID / BIN / VAT No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 002341948-0101"
                    value={formData.tax_identifier}
                    onChange={(e) => setFormData({ ...formData, tax_identifier: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default font-mono focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div className="space-y-3 pt-2 border-t border-default/60">
            <div className="flex items-center gap-1.5 font-bold text-default uppercase tracking-wider text-[11px]">
              <Phone className="size-3.5 text-primary" />
              <span>Contact & Communication</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-default mb-1">
                  Contact Person
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Key account manager"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken pl-8 pr-3 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-default mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="+880 1700-000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken pl-8 pr-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-default mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
                  <input
                    type="email"
                    placeholder="sales@vendor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken pl-8 pr-3 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location / Address */}
          <div className="space-y-3 pt-2 border-t border-default/60">
            <div className="flex items-center gap-1.5 font-bold text-default uppercase tracking-wider text-[11px]">
              <MapPin className="size-3.5 text-primary" />
              <span>Location / Dispatch Office</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={quickMode ? 'sm:col-span-2' : 'sm:col-span-1'}>
                <label className="block font-semibold text-muted mb-1">City / Region</label>
                <input
                  type="text"
                  placeholder="e.g. Dhaka, Chittagong, Gazipur"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              {!quickMode && (
                <>
                  <div>
                    <label className="block font-semibold text-muted mb-1">District / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Tejgaon I/A"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-muted mb-1">Postal Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 1208"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    />
                  </div>
                </>
              )}

              <div className={quickMode ? 'sm:col-span-1' : 'sm:col-span-3'}>
                <label className="block font-semibold text-muted mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. Plot 14, Block C, Industrial Zone"
                  value={formData.line1}
                  onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Trade Terms & Credit Controls (Full Mode) */}
          {!quickMode && (
            <div className="space-y-3 pt-2 border-t border-default/60">
              <div className="flex items-center gap-1.5 font-bold text-default uppercase tracking-wider text-[11px]">
                <CreditCard className="size-3.5 text-primary" />
                <span>Trade Terms & Financials</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Payment Term (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={formData.credit_days}
                    onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted mb-1">Credit Limit (BDT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active (Permitted)</option>
                    <option value="inactive">Inactive</option>
                    <option value="blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-default flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="size-4" />
              <span>{isSubmitting ? 'Saving Supplier...' : supplier ? 'Update Supplier' : quickMode ? 'Add & Select Supplier' : 'Save Supplier Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SupplierFormModal: React.FC<SupplierFormModalProps> = (props) => {
  if (!props.open) return null;
  const key = props.supplier?.id ? `edit-sup-${props.supplier.id}` : 'new-sup';
  return <SupplierFormDialog key={key} {...props} />;
};

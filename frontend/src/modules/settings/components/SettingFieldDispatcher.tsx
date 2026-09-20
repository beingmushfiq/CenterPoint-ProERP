import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { SettingFieldSchema } from '../../../types/api/settings';
import { MultiChannelChipSelect } from './fields/MultiChannelChipSelect';
import { RangeSliderField } from './fields/RangeSliderField';
import { CurrencyAmountField } from './fields/CurrencyAmountField';
import { DurationStepperField } from './fields/DurationStepperField';
import { SegmentedRadioCards } from './fields/SegmentedRadioCards';
import { BrandAssetField } from './fields/BrandAssetField';
import { PrefixSerialField } from './fields/PrefixSerialField';
import { EncryptedVaultField } from './fields/EncryptedVaultField';
import { SettingToggleCard } from './fields/SettingToggleCard';
import { LegalIdentifierField } from './fields/LegalIdentifierField';
import { AddressLocationField } from './fields/AddressLocationField';
import { ContactPhoneField } from './fields/ContactPhoneField';
import { ContactEmailField } from './fields/ContactEmailField';
import { NumericStepperField } from './fields/NumericStepperField';
import { FormattedNoteField } from './fields/FormattedNoteField';
import { DynamicTextField } from './fields/DynamicTextField';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { useCurrency } from '../../../hooks/useCurrency';

import { SEGMENTED_OPTIONS } from '../config/segmentedOptions';

interface SettingFieldDispatcherProps {
  settingKey: string;
  meta: SettingFieldSchema;
  value: unknown;
  onChange: (val: unknown) => void;
  currencySymbol?: string;
  currencyCode?: string;
}

const DROPDOWN_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  material_allocation_policy: [
    { label: 'FIFO (Earliest Received Stock First)', value: 'fifo' },
    { label: 'FEFO (First Expired, First Out)', value: 'fefo' },
    { label: 'LIFO (Latest In, First Out)', value: 'lifo' },
  ],
  default_payment_terms: [
    { label: 'Immediate / Due on Receipt', value: 'due_on_receipt' },
    { label: 'Net 15 Days', value: 'net_15' },
    { label: 'Net 30 Days', value: 'net_30' },
    { label: 'Net 60 Days', value: 'net_60' },
  ],
  credit_limit_action: [
    { label: 'Strictly Block New Sales Orders', value: 'block_order' },
    { label: 'Warn Sales Agent but Allow Submission', value: 'warn' },
    { label: 'Require Financial Director PIN Override', value: 'supervisor_pin' },
  ],
  receipt_printer_template: [
    { label: 'Standard Thermal POS (80mm Width)', value: 'thermal_80mm' },
    { label: 'Compact Thermal POS (58mm Width)', value: 'thermal_58mm' },
    { label: 'Formal Full-Page Invoice (A4 Standard)', value: 'standard_a4' },
  ],
  default_courier_provider: [
    { label: 'Steadfast Courier Logistics', value: 'steadfast' },
    { label: 'Pathao Courier & Parcel API', value: 'pathao' },
    { label: 'REDX Express Logistics', value: 'redx' },
    { label: 'Paperfly Smart Logistics', value: 'paperfly' },
  ],
  sms_provider: [
    { label: 'Greenweb SMS Gateway (Bangladesh)', value: 'greenweb' },
    { label: 'Twilio Global Communications', value: 'twilio' },
    { label: 'BulkSMS BD Enterprise', value: 'bulksmsbd' },
    { label: 'Infobip Global Messaging', value: 'infobip' },
  ],
  sampling_aql_standard: [
    { label: 'ISO 2859-1 / AQL Level II (Normal)', value: 'aql_level_ii' },
    { label: 'ISO 2859-1 / AQL Level I (Reduced Sampling)', value: 'aql_level_i' },
    { label: 'ISO 2859-1 / AQL Level III (Tightened Sampling)', value: 'aql_level_iii' },
  ],
  default_depreciation_method: [
    { label: 'Straight-Line Depreciation Method', value: 'straight_line' },
    { label: 'Declining-Balance Method', value: 'declining_balance' },
  ],
  default_paper_size: [
    { label: 'ISO A4 (210mm × 297mm)', value: 'a4' },
    { label: 'US Letter (8.5in × 11in)', value: 'letter' },
    { label: 'US Legal (8.5in × 14in)', value: 'legal' },
  ],
  asset_disposal_auth_role: [
    { label: 'Master SaaS Super Administrator', value: 'super_admin' },
    { label: 'Plant General Manager / Admin', value: 'admin' },
    { label: 'Chief Financial Officer / Director', value: 'finance_director' },
  ],
  date_format: [
    { label: 'YYYY-MM-DD (2026-08-29)', value: 'YYYY-MM-DD' },
    { label: 'DD/MM/YYYY (29/08/2026)', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY (08/29/2026)', value: 'MM/DD/YYYY' },
    { label: 'DD-MMM-YYYY (29-Aug-2026)', value: 'DD-MMM-YYYY' },
  ],
  system_timezone: [
    { label: 'Asia/Dhaka (UTC+06:00)', value: 'Asia/Dhaka' },
    { label: 'Asia/Kolkata (UTC+05:30)', value: 'Asia/Kolkata' },
    { label: 'Asia/Dubai (UTC+04:00)', value: 'Asia/Dubai' },
    { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
    { label: 'America/New_York (UTC-05:00)', value: 'America/New_York' },
    { label: 'Europe/London (UTC+00:00)', value: 'Europe/London' },
  ],
  system_language: [
    { label: 'English (US / International)', value: 'en' },
    { label: 'Bengali / বাংলা (Local BD Interface)', value: 'bn' },
  ],
};

export const SettingFieldDispatcher: React.FC<SettingFieldDispatcherProps> = ({
  settingKey,
  meta,
  value,
  onChange,
  currencySymbol: propSymbol,
  currencyCode: propCode,
}) => {
  const { currencyCode: defaultCode, currencySymbol: defaultSymbol } = useCurrency();
  const currencySymbol = propSymbol || defaultSymbol;
  const currencyCode = propCode || defaultCode;

  // 1. Encrypted Sensitive Credential Fields
  if (meta.sensitive) {
    return (
      <EncryptedVaultField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        description={meta.description}
      />
    );
  }

  // 2. Boolean Operational Toggle Switches
  if (meta.type === 'boolean') {
    return (
      <SettingToggleCard
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        description={meta.description}
      />
    );
  }

  // 3. Visual Segmented Radio Cards (Checked before heuristics)
  if (SEGMENTED_OPTIONS[settingKey]) {
    return (
      <SegmentedRadioCards
        label={meta.label}
        settingKey={settingKey}
        value={value}
        options={SEGMENTED_OPTIONS[settingKey]}
        onChange={onChange}
        description={meta.description}
      />
    );
  }

  // 4. Curated Dropdowns with High-Polish Header & Badge (Checked before heuristics)
  const dropdownOpts = DROPDOWN_OPTIONS[settingKey];
  if (dropdownOpts) {
    return (
      <div className="group rounded-xl border border-default/80 bg-surface p-4 transition-all duration-200 hover:border-default hover:shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`field-${settingKey}`}
            className="flex items-center gap-2 text-xs font-semibold text-default cursor-pointer"
          >
            <SlidersHorizontal className="size-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
            <span>{meta.label}</span>
          </label>
          <span className="text-[10px] font-medium text-muted bg-surface-sunken border border-default/60 px-2 py-0.5 rounded-md select-none shrink-0">
            Curated Policy
          </span>
        </div>
        <SelectDropdown
          options={dropdownOpts}
          value={typeof value === 'string' ? value : String(meta.default ?? '')}
          onChange={(val) => onChange(val)}
          size="md"
          buttonClassName="w-full"
          aria-label={meta.label}
        />
        <p className="text-[11px] text-muted leading-relaxed">
          {meta.description || 'Select approved enterprise standard.'}
        </p>
      </div>
    );
  }

  // 5. Multi-Channel JSON Array Fields
  if (
    meta.type === 'json' ||
    settingKey.endsWith('_channels') ||
    settingKey === 'allowed_payment_methods'
  ) {
    return (
      <MultiChannelChipSelect
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        description={meta.description}
      />
    );
  }

  // 6. Percentage & Ratio Slider Fields
  if (
    settingKey.includes('percent') ||
    settingKey.includes('tolerance') ||
    settingKey === 'sampling_percentage' ||
    settingKey === 'cod_charge_percentage'
  ) {
    return (
      <RangeSliderField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        min={0}
        max={settingKey.includes('yield') ? 100 : settingKey.includes('discount') ? 50 : 30}
        step={0.5}
        description={meta.description}
      />
    );
  }

  // 7. Monetary Amount Fields
  if (
    settingKey.includes('_amount') ||
    settingKey.includes('threshold_amount') ||
    settingKey === 'min_order_amount' ||
    settingKey === 'free_shipping_threshold' ||
    settingKey === 'max_cash_drawer_variance_alert'
  ) {
    return (
      <CurrencyAmountField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
        description={meta.description}
      />
    );
  }

  // 8. Corporate & Legal Registration Identifiers
  if (
    settingKey === 'company_name' ||
    settingKey === 'company_legal_name' ||
    settingKey === 'trade_license_no' ||
    settingKey === 'tax_identification_number' ||
    settingKey === 'rjsc_registration_no' ||
    settingKey === 'factory_license_no' ||
    settingKey === 'bin_branch_code'
  ) {
    return (
      <LegalIdentifierField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={(val) => onChange(val)}
        description={meta.description}
      />
    );
  }

  // 9. Headquarters & Plant Physical Address Fields (Strict match avoiding substring collision with 'allocation')
  if (
    settingKey.includes('address') ||
    settingKey === 'registered_location' ||
    settingKey === 'factory_location' ||
    settingKey.endsWith('_location')
  ) {
    return (
      <AddressLocationField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={(val) => onChange(val)}
        description={meta.description}
      />
    );
  }

  // 10. Telephone & Direct Operations Hotline Fields
  if (
    settingKey.includes('phone') ||
    settingKey.includes('hotline') ||
    settingKey.includes('mobile') ||
    settingKey === 'whatsapp_business_number'
  ) {
    return (
      <ContactPhoneField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={(val) => onChange(val)}
        description={meta.description}
      />
    );
  }

  // 11. Official & Transactional Email Fields
  if (settingKey.includes('email')) {
    return (
      <ContactEmailField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={(val) => onChange(val)}
        description={meta.description}
      />
    );
  }

  // 12. Customer Greetings, Receipt Notes & Hero Copy
  if (
    settingKey.includes('note') ||
    settingKey.includes('tagline') ||
    settingKey.includes('hero_') ||
    settingKey.includes('message') ||
    settingKey === 'default_walk_in_customer'
  ) {
    return (
      <FormattedNoteField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={(val) => onChange(val)}
        description={meta.description}
      />
    );
  }

  // 13. Duration & Lead-Time Stepper Fields
  if (
    settingKey.endsWith('_days') ||
    settingKey.endsWith('_minutes') ||
    settingKey.endsWith('_months')
  ) {
    const unit = settingKey.endsWith('_minutes')
      ? 'Minutes'
      : settingKey.endsWith('_months')
      ? 'Months'
      : 'Days';

    return (
      <DurationStepperField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        unit={unit}
        min={1}
        max={unit === 'Minutes' ? 1440 : unit === 'Months' ? 24 : 365}
        description={meta.description}
      />
    );
  }

  // 14. Brand Asset & Image Fields
  if (
    settingKey === 'brand_logo_url' ||
    settingKey === 'brand_favicon_url' ||
    (settingKey.endsWith('_url') && !settingKey.includes('api'))
  ) {
    return (
      <BrandAssetField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        description={meta.description}
      />
    );
  }

  // 15. Document Prefix Fields
  if (settingKey.endsWith('_prefix')) {
    return (
      <PrefixSerialField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={onChange}
        description={meta.description}
      />
    );
  }

  // 16. Purpose-Built Numeric Steppers for Counts, Multipliers, Chars, Hours
  if (meta.type === 'number') {
    return (
      <NumericStepperField
        label={meta.label}
        settingKey={settingKey}
        value={value}
        onChange={(val) => onChange(val)}
        min={0}
        description={meta.description}
      />
    );
  }

  // 17. High-Polish Dynamic Text Field (Replaces plain raw text input)
  return (
    <DynamicTextField
      label={meta.label}
      settingKey={settingKey}
      value={value}
      onChange={(val) => onChange(val)}
      description={meta.description}
    />
  );
};

import type { LeadStatus, LeadSource } from '../../types/api/crm';

export interface StageConfig {
  id: LeadStatus;
  label: string;
  tone: string;
  dotBg: string;
  badgeBg: string;
}

export const STAGES: StageConfig[] = [
  { id: 'new', label: 'New Inquiries', tone: 'text-sky-600 dark:text-sky-400', dotBg: 'bg-sky-500', badgeBg: 'bg-sky-500/10 border-sky-500/20' },
  { id: 'contacted', label: 'Contacted', tone: 'text-blue-600 dark:text-blue-400', dotBg: 'bg-blue-500', badgeBg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'qualified', label: 'Qualified', tone: 'text-indigo-600 dark:text-indigo-400', dotBg: 'bg-indigo-500', badgeBg: 'bg-indigo-500/10 border-indigo-500/20' },
  { id: 'proposal', label: 'Proposal Sent', tone: 'text-purple-600 dark:text-purple-400', dotBg: 'bg-purple-500', badgeBg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'negotiation', label: 'In Negotiation', tone: 'text-amber-600 dark:text-amber-400', dotBg: 'bg-amber-500', badgeBg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'won', label: 'Closed Won', tone: 'text-emerald-600 dark:text-emerald-400', dotBg: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'lost', label: 'Closed Lost', tone: 'text-rose-600 dark:text-rose-400', dotBg: 'bg-rose-500', badgeBg: 'bg-rose-500/10 border-rose-500/20' },
  { id: 'fake', label: 'Fake / Invalid', tone: 'text-danger', dotBg: 'bg-danger', badgeBg: 'bg-danger-subtle border-danger' },
];

export interface SourceConfig {
  id: LeadSource;
  label: string;
  badgeClass?: string;
}

export const LEAD_SOURCES: SourceConfig[] = [
  { id: 'storefront', label: 'Storefront / Web' },
  { id: 'walk_in', label: 'Walk-in Customer' },
  { id: 'phone', label: 'Inbound Phone Call' },
  { id: 'field_visit', label: 'Field Visit / Rep' },
  { id: 'referral', label: 'Customer Referral' },
  { id: 'cold_outreach', label: 'Cold Outreach' },
  { id: 'event', label: 'Trade Event / Expo' },
  { id: 'social_media', label: 'Social Media Channel' },
  { id: 'website', label: 'Website Organic' },
  { id: 'online', label: 'Online Inbound' },
  { id: 'other', label: 'Other Acquisition' },
];

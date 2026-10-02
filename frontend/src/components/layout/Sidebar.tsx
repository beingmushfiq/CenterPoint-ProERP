import { useState, useMemo, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Search,
  Layers,
  ChevronDown,
  ChevronRight,
  X,
  Download,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { useTenantCapabilityStore } from '../../lib/capabilities/tenantCapabilityStore';
import { buildDynamicNavSections } from '../../lib/capabilities/navRegistry';
import { useTenantBranding, isStaleEngineName } from '../../lib/theme/useTenantBranding';
import { getAppVersion } from '../../lib/config/appVersion';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Resolves semantic category dots for sidebar section headers.
 */
function getSectionDotTone(sectionId: string): string {
  switch (sectionId) {
    case 'overview':
      return 'bg-indigo-500 shadow-xs shadow-indigo-500/50';
    case 'supply':
      return 'bg-amber-500 shadow-xs shadow-amber-500/50';
    case 'production':
      return 'bg-orange-500 shadow-xs shadow-orange-500/50';
    case 'sales':
      return 'bg-emerald-500 shadow-xs shadow-emerald-500/50';
    case 'crm':
      return 'bg-purple-500 shadow-xs shadow-purple-500/50';
    case 'finance':
      return 'bg-emerald-500 shadow-xs shadow-emerald-500/50';
    case 'hr':
      return 'bg-teal-500 shadow-xs shadow-teal-500/50';
    case 'system':
      return 'bg-blue-500 shadow-xs shadow-blue-500/50';
    default:
      return 'bg-primary/70';
  }
}

/**
 * Resolves semantic, accessible Lucide icon color classes for top-level sidebar items.
 * Each module domain receives a dedicated, brand-appropriate color tone with glow on active.
 */
function getParentTone(id: string, active: boolean): string {
  const normId = id.toLowerCase();

  // 1. Overview & Monitoring
  if (normId === 'dashboard') {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId === 'reports') {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }

  // 2. Inventory & Supply
  if (normId === 'catalogue' || normId.includes('catalog')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId === 'purchasing') {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId === 'inventory' || normId.includes('stock') || normId.includes('warehouse')) {
    return active
      ? 'text-sky-600 dark:text-sky-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]'
      : 'text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300';
  }
  if (normId === 'delivery' || normId.includes('logistics')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }

  // 3. Production & Quality
  if (normId === 'production') {
    return active
      ? 'text-orange-600 dark:text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]'
      : 'text-orange-500 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300';
  }
  if (normId === 'qc' || normId.includes('quality')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }

  // 4. Sales & Commercials
  if (normId === 'sales') {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId === 'pos') {
    return active
      ? 'text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]'
      : 'text-cyan-500 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300';
  }
  if (normId === 'ecommerce' || normId.includes('store')) {
    return active
      ? 'text-pink-600 dark:text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]'
      : 'text-pink-500 dark:text-pink-400 group-hover:text-pink-600 dark:group-hover:text-pink-300';
  }
  if (normId === 'coupons') {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }

  // 5. CRM & Customer Pipeline
  if (normId === 'crm-leads' || normId === 'crm' || normId.includes('lead')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }

  // 6. Finance & Accounts
  if (normId === 'finance') {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId === 'assets') {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }

  // 7. Team & Workforce
  if (normId === 'hr' || normId.includes('workforce') || normId.includes('team')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }

  // 8. Intelligence & System
  if (normId === 'roles') {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId === 'audit') {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId === 'users') {
    return active
      ? 'text-sky-600 dark:text-sky-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]'
      : 'text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300';
  }
  if (normId === 'bin') {
    return active
      ? 'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
      : 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300';
  }
  if (normId === 'workflows') {
    return active
      ? 'text-amber-500 dark:text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId === 'settings') {
    return active
      ? 'text-slate-600 dark:text-slate-300 drop-shadow-[0_0_8px_rgba(100,116,139,0.5)]'
      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300';
  }

  // Fallback
  return active
    ? 'text-primary dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]'
    : 'text-muted group-hover:text-default';
}

/**
 * Resolves semantic, accessible Lucide icon color classes for sub-navigation items.
 */
function getChildTone(id: string, active: boolean): string {
  const normId = id.toLowerCase();

  // Sales & CRM
  if (normId.includes('order')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId.includes('invoice')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('deliver') || normId.includes('dispatch')) {
    return active
      ? 'text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]'
      : 'text-cyan-500 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300';
  }
  if (normId.includes('payment') || normId.includes('receipt')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId.includes('return') || normId.includes('scrap') || normId.includes('defect') || normId.includes('wastage') || normId.includes('trash') || normId.includes('bin')) {
    return active
      ? 'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]'
      : 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300';
  }
  if (normId.includes('exchange')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('pipeline') || normId.includes('kanban') || normId.includes('stage')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }
  if (normId.includes('lead') || normId.includes('crm')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }
  if (normId.includes('customer')) {
    return active
      ? 'text-violet-600 dark:text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]'
      : 'text-violet-500 dark:text-violet-400 group-hover:text-violet-600 dark:group-hover:text-violet-300';
  }
  if (normId.includes('pricelist')) {
    return active
      ? 'text-fuchsia-600 dark:text-fuchsia-400 drop-shadow-[0_0_6px_rgba(217,70,239,0.4)]'
      : 'text-fuchsia-500 dark:text-fuchsia-400 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-300';
  }
  if (normId.includes('salesmen') || normId.includes('rep')) {
    return active
      ? 'text-sky-600 dark:text-sky-400 drop-shadow-[0_0_6px_rgba(14,165,233,0.4)]'
      : 'text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300';
  }
  if (normId.includes('target')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }
  if (normId.includes('incentive') || normId.includes('bonus') || normId.includes('commission')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }

  // Assets Management
  if (normId.includes('machinery') || normId.includes('plant')) {
    return active
      ? 'text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]'
      : 'text-cyan-500 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300';
  }
  if (normId.includes('maintenance')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('timeline') || normId.includes('history')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('register') || normId.includes('asset')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId.includes('depreciation')) {
    return active
      ? 'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]'
      : 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300';
  }

  // Workforce & HR
  if (normId.includes('employee') || normId.includes('department') || normId.includes('people') || normId.includes('staff')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('attendance')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('leave')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('payroll') || normId.includes('salary')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId.includes('advance')) {
    return active
      ? 'text-orange-600 dark:text-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]'
      : 'text-orange-500 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300';
  }
  if (normId.includes('performance') || normId.includes('piece')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }

  // Product Catalog & Recipes
  if (normId.includes('product')) {
    return active
      ? 'text-sky-600 dark:text-sky-400 drop-shadow-[0_0_6px_rgba(14,165,233,0.4)]'
      : 'text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300';
  }
  if (normId.includes('categor')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }
  if (normId.includes('brand')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('unit')) {
    return active
      ? 'text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]'
      : 'text-cyan-500 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300';
  }
  if (normId.includes('bom') || normId.includes('recipe')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId.includes('warehouse')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('part')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }

  // Purchasing & Inventory
  if (normId.includes('pur-') || normId.includes('requisition')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('grn') || normId.includes('receipt')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId.includes('ledger') || normId.includes('balance')) {
    return active
      ? 'text-sky-600 dark:text-sky-400 drop-shadow-[0_0_6px_rgba(14,165,233,0.4)]'
      : 'text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300';
  }
  if (normId.includes('threshold') || normId.includes('reorder')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('transfer')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('adjustment')) {
    return active
      ? 'text-violet-600 dark:text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]'
      : 'text-violet-500 dark:text-violet-400 group-hover:text-violet-600 dark:group-hover:text-violet-300';
  }
  if (normId.includes('count')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }

  // Logistics & Delivery
  if (normId.includes('shipment')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('runsheet') || normId.includes('run_sheet')) {
    return active
      ? 'text-sky-600 dark:text-sky-400 drop-shadow-[0_0_6px_rgba(14,165,233,0.4)]'
      : 'text-sky-500 dark:text-sky-400 group-hover:text-sky-600 dark:group-hover:text-sky-300';
  }
  if (normId.includes('provider') || normId.includes('courier')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId.includes('cod')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }

  // Production & QC
  if (normId.includes('plan')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId.includes('batch')) {
    return active
      ? 'text-orange-600 dark:text-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]'
      : 'text-orange-500 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300';
  }
  if (normId.includes('timesheet')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('inspection')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('parameter')) {
    return active
      ? 'text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]'
      : 'text-cyan-500 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300';
  }

  // Online Storefront CMS
  if (normId.includes('branding') || normId.includes('theme')) {
    return active
      ? 'text-pink-600 dark:text-pink-400 drop-shadow-[0_0_6px_rgba(236,72,153,0.4)]'
      : 'text-pink-500 dark:text-pink-400 group-hover:text-pink-600 dark:group-hover:text-pink-300';
  }
  if (normId.includes('header') || normId.includes('footer')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }
  if (normId.includes('checkout')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('coupon')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('domain')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }

  // Finance & Accounts
  if (normId.includes('banking') || normId.includes('cash')) {
    return active
      ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]'
      : 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300';
  }
  if (normId.includes('expense')) {
    return active
      ? 'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]'
      : 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300';
  }
  if (normId.includes('due')) {
    return active
      ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('statement') || normId.includes('p&l') || normId.includes('pl')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId.includes('journal')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('coa')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('costing')) {
    return active
      ? 'text-purple-600 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
      : 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300';
  }

  // System Settings
  if (normId.includes('overview') || normId.includes('hub')) {
    return active
      ? 'text-amber-500 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('security')) {
    return active
      ? 'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]'
      : 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300';
  }
  if (normId.includes('profile')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('module')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('workflow') || normId.includes('flow')) {
    return active
      ? 'text-amber-500 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      : 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300';
  }
  if (normId.includes('terminology')) {
    return active
      ? 'text-fuchsia-600 dark:text-fuchsia-400 drop-shadow-[0_0_6px_rgba(217,70,239,0.4)]'
      : 'text-fuchsia-500 dark:text-fuchsia-400 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-300';
  }
  if (normId.includes('custom_field')) {
    return active
      ? 'text-violet-600 dark:text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]'
      : 'text-violet-500 dark:text-violet-400 group-hover:text-violet-600 dark:group-hover:text-violet-300';
  }
  if (normId.includes('document')) {
    return active
      ? 'text-blue-600 dark:text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'
      : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300';
  }
  if (normId.includes('integration')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }
  if (normId.includes('notification')) {
    return active
      ? 'text-teal-600 dark:text-teal-400 drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]'
      : 'text-teal-500 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300';
  }
  if (normId.includes('backup')) {
    return active
      ? 'text-rose-600 dark:text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]'
      : 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300';
  }
  if (normId.includes('general')) {
    return active
      ? 'text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
      : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300';
  }

  return active
    ? 'text-primary dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]'
    : 'text-muted-foreground group-hover:text-default';
}

function getGroupDotTone(groupName?: string): string {
  if (!groupName) return 'bg-primary/60';
  const g = groupName.toLowerCase();
  if (g.includes('master') || g.includes('catalog')) return 'bg-blue-500';
  if (g.includes('engineering') || g.includes('recipe') || g.includes('bom')) return 'bg-emerald-500';
  if (g.includes('director') || g.includes('location')) return 'bg-teal-500';
  if (g.includes('cash') || g.includes('valuation') || g.includes('payroll') || g.includes('fiscal') || g.includes('settlement')) return 'bg-emerald-500';
  if (g.includes('governance') || g.includes('loss') || g.includes('sla')) return 'bg-amber-500';
  if (g.includes('machinery') || g.includes('dispatch') || g.includes('security')) return 'bg-cyan-500';
  if (g.includes('pipeline') || g.includes('automation') || g.includes('store') || g.includes('appearance')) return 'bg-purple-500';
  if (g.includes('people') || g.includes('inspection') || g.includes('lead')) return 'bg-teal-500';
  return 'bg-primary/60';
}

export function Sidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const tenant = useAuthStore((state) => state.tenant);
  const modules = useTenantCapabilityStore((state) => state.modules);
  const isModuleEnabled = useTenantCapabilityStore((state) => state.isModuleEnabled);
  const getTerm = useTenantCapabilityStore((state) => state.getTerm);
  const navOrder = useTenantCapabilityStore((state) => state.manifest?.nav_order);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();

  // Collapsed sections accordion memory (persisted in localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('erp_sidebar_collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch (_err) {
      void _err;
      return {};
    }
  });

  // Expandable parent modules with sub-navigation (e.g. Sales) - default collapsed
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('erp_sidebar_expanded_parents');
      return saved ? JSON.parse(saved) : {};
    } catch (_err) {
      void _err;
      return {};
    }
  });

  const toggleParent = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedParents((prev) => {
      const current = prev[itemId] ?? false;
      const next = { ...prev, [itemId]: !current };
      try {
        localStorage.setItem('erp_sidebar_expanded_parents', JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionTitle]: !prev[sectionTitle] };
      try {
        localStorage.setItem('erp_sidebar_collapsed_sections', JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };

  const workspaceSubtitle = useMemo(() => {
    if (!user?.role) return i18n.language === 'bn' ? 'অপারেশনস কর্মক্ষেত্র' : 'Operations Workspace';
    if (user.role.includes('Super Administrator') || user.is_platform_admin) {
      return i18n.language === 'bn' ? 'এক্সিকিউটিভ কমান্ড' : 'Executive Command';
    }
    if (user.role.includes('Production')) {
      return i18n.language === 'bn' ? 'উৎপাদন কর্মক্ষেত্র' : 'Production Workspace';
    }
    if (user.role.includes('QC') || user.role.includes('Quality')) {
      return i18n.language === 'bn' ? 'গুণমান ও পরিদর্শন' : 'Quality & Assurance';
    }
    if (user.role.includes('Store') || user.role.includes('Warehouse')) {
      return i18n.language === 'bn' ? 'গুদাম ও লজিস্টিকস' : 'Warehouse & Logistics';
    }
    if (user.role.includes('Sales') || user.role.includes('Commercial')) {
      return i18n.language === 'bn' ? 'বাণিজ্যিক ও খুচরা' : 'Commercial & Retail';
    }
    return `${user.role} ${i18n.language === 'bn' ? 'কর্মক্ষেত্র' : 'Workspace'}`;
  }, [user, i18n.language]);

  const isItemActive = (to: string, isActive: boolean) => {
    // 1. If 'to' specifies exact query parameters (e.g., '/sales?tab=leads')
    if (to.includes('?')) {
      const [toPath, toQuery] = to.split('?');
      if (toPath && toQuery && location.pathname === toPath && location.search.includes(toQuery)) {
        return true;
      }
      return false;
    }

    // 2. Active matching for '/sales'
    if (to === '/sales') {
      if (location.pathname === '/sales' && location.search.includes('tab=leads')) {
        return false;
      }
      return location.pathname === '/sales' || location.pathname.startsWith('/sales/');
    }

    // 2a. Active matching for '/crm'
    if (to === '/crm') {
      if (location.pathname === '/sales' && location.search.includes('tab=leads')) {
        return true;
      }
      return location.pathname === '/crm' || location.pathname.startsWith('/crm/');
    }

    // 2b. Case for '/storefront': Keep Online Store CMS active across all storefront sub-tabs
    if (to === '/storefront') {
      return location.pathname === '/storefront' || location.pathname.startsWith('/storefront/');
    }

    // 3. Special case for '/settings': if URL is a dedicated item, do not highlight general settings
    if (to === '/settings') {
      if (
        location.pathname.startsWith('/settings/roles') ||
        location.pathname.startsWith('/settings/users') ||
        location.pathname.startsWith('/settings/bin') ||
        location.pathname.startsWith('/settings/workflows') ||
        location.pathname.startsWith('/settings/audit-logs') ||
        location.pathname.startsWith('/settings/webhooks')
      ) {
        return false;
      }
      return location.pathname === '/settings' || location.pathname.startsWith('/settings/');
    }

    // 3b. Dedicated sub-routes & aliases for system governance
    if (to === '/settings/roles' || to === '/roles') {
      return location.pathname.startsWith('/settings/roles') || location.pathname.startsWith('/roles');
    }
    if (to === '/settings/users' || to === '/users') {
      return location.pathname.startsWith('/settings/users') || location.pathname.startsWith('/users');
    }
    if (to === '/activity-logs' || to === '/audit-logs' || to === '/audit') {
      return (
        location.pathname.startsWith('/activity-logs') ||
        location.pathname.startsWith('/audit-logs') ||
        location.pathname.startsWith('/audit') ||
        location.pathname.startsWith('/settings/audit-logs')
      );
    }
    if (to === '/settings/bin' || to === '/bin') {
      return location.pathname.startsWith('/settings/bin') || location.pathname.startsWith('/bin');
    }
    if (to === '/settings/workflows' || to === '/workflows') {
      return location.pathname.startsWith('/settings/workflows') || location.pathname.startsWith('/workflows');
    }
    if (to === '/webhooks' || to === '/settings/webhooks') {
      return location.pathname.startsWith('/webhooks') || location.pathname.startsWith('/settings/webhooks');
    }

    // 4. Aliases for HR module
    if (to === '/hr') {
      return (
        location.pathname === '/hr' ||
        location.pathname.startsWith('/hr/') ||
        location.pathname.startsWith('/workforce') ||
        location.pathname.startsWith('/employees') ||
        location.pathname.startsWith('/attendance') ||
        location.pathname.startsWith('/payroll')
      );
    }

    // 5. Aliases for Finance module
    if (to === '/finance') {
      return (
        location.pathname === '/finance' ||
        location.pathname.startsWith('/finance/') ||
        location.pathname.startsWith('/accounting')
      );
    }

    // 6. Aliases for Delivery / Logistics module
    if (to === '/logistics') {
      return (
        location.pathname === '/logistics' ||
        location.pathname.startsWith('/logistics/') ||
        location.pathname.startsWith('/delivery')
      );
    }

    // 7. Standard matching: if target URL contains query parameters, verify query parameter values match
    const [toPath, toQuery] = to.split('?');
    if (toQuery) {
      if (location.pathname !== toPath) return false;
      const currentParams = new URLSearchParams(location.search);
      const targetParams = new URLSearchParams(toQuery);
      return Array.from(targetParams.entries()).every(
        ([key, value]) => currentParams.get(key) === value
      );
    }

    if (location.pathname === toPath || location.pathname.startsWith(`${toPath}/`)) {
      return true;
    }

    return isActive;
  };

  const navSections = useMemo(
    () =>
      buildDynamicNavSections(
        (key) => {
          const mod = modules[key];
          return mod !== undefined ? Boolean(mod.enabled && mod.plan_allowed) : isModuleEnabled(key);
        },
        hasPermission,
        getTerm,
        navOrder
      ),
    [isModuleEnabled, hasPermission, getTerm, navOrder, modules]
  );

  const { companyName } = useTenantBranding();
  const brandingRecord = tenant?.branding as Record<string, unknown> | undefined;
  const brandingName = typeof brandingRecord?.['name'] === 'string' ? brandingRecord['name'] : undefined;
  const tenantName = brandingName || tenant?.name;
  const tenantDisplayName: string = useMemo(() => {
    if (companyName && !isStaleEngineName(companyName)) {
      return companyName;
    }
    if (tenantName && !isStaleEngineName(tenantName)) {
      return tenantName;
    }
    return 'Operations Platform';
  }, [companyName, tenantName]);

  const erpInstallTitle = useMemo((): string => {
    const base = tenantDisplayName.replace(/\s+ERP$/i, '').trim();
    return `${base} ERP`;
  }, [tenantDisplayName]);
  // Close on Escape key when mobile sidebar is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const appVersion = getAppVersion();
  const statusLabel = tenant?.status === 'active'
    ? t('common:status.active', 'Active')
    : (tenant?.status ? tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1) : (i18n.language === 'bn' ? 'এন্টারপ্রাইজ' : 'Enterprise'));
  const editionLabel = i18n.language === 'bn' ? 'সংস্করণ' : 'Edition';
  const tenantTier = `${statusLabel} ${editionLabel}`;
  const tenantShortBadge = 'ERP';

  return (
    <>
      {/* Mobile backdrop with frosted blur */}
      {isOpen && (
        <div
          className="fixed inset-0 z-(--z-overlay) bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Adaptive Luxury Sidebar container */}
      {/* Adaptive Luxury Sidebar container */}
      <aside
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-label="Navigation drawer"
        className={cn(
          'fixed top-0 bottom-0 left-0 z-(--z-modal) lg:z-30 flex flex-col border-r border-(--nav-border) bg-(--nav-bg) text-default transition-all duration-300 ease-in-out lg:translate-x-0 select-none shadow-2xl dark:shadow-black/90 touch-pan-y',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed
            ? 'w-[min(20rem,calc(100vw-2.5rem))] sm:w-72 lg:w-20'
            : 'w-[min(20rem,calc(100vw-2.5rem))] sm:w-72 lg:w-72'
        )}
      >
        {/* Subtle Ambient Radial Lighting for Dark Mode */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-indigo-500/5 via-emerald-500/2 to-transparent dark:from-indigo-500/10 dark:via-emerald-500/4"
          aria-hidden="true"
        />

        {/* Brand Monogram & Identity Header */}
        <div
          className={cn(
            'relative flex h-16 items-center border-b border-(--nav-border) px-3.5 shrink-0 bg-(--nav-bg)/95 backdrop-blur-md transition-all',
            isCollapsed ? 'lg:justify-center justify-between' : 'justify-between'
          )}
        >
          <Link
            to="/dashboard"
            onClick={() => {
              if (window.innerWidth < 1024) {
                onClose();
              }
            }}
            className="group flex items-center gap-3 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl transition-all cursor-pointer select-none"
            title="Go to Dashboard"
            aria-label={`${tenantDisplayName} - Go to Dashboard`}
          >
            {/* Custom Multi-Stop Geometric Emblem */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 via-indigo-600 to-indigo-800 p-0.5 shadow-md shadow-indigo-500/20 ring-1 ring-black/5 dark:ring-white/20 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-white dark:bg-[#090d16]/90 backdrop-blur-xs">
                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)] transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white dark:ring-[#070a10]" />
              </span>
            </div>

            {/* Tenant details (hidden when collapsed on desktop) */}
            <div className={cn('min-w-0', isCollapsed && 'lg:hidden')}>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-default text-sm truncate font-sans group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {tenantDisplayName}
                </span>
                <span className="inline-flex items-center rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 tracking-wider uppercase font-mono">
                  {tenantShortBadge}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-medium text-muted truncate flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                  {workspaceSubtitle}
                </span>
              </div>
            </div>
          </Link>

          {/* Mobile close button (< lg) */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer shrink-0"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick Command & Workspace Search */}
        <div className={cn('px-3 pt-3 pb-1 shrink-0', isCollapsed && 'lg:hidden')}>
          <div className="relative flex items-center w-full rounded-lg bg-(--nav-bg-deep) border border-(--nav-border) px-2.5 py-1.5 text-xs text-muted hover:border-primary/40 transition-colors group">
            <Search className="size-3.5 text-muted group-hover:text-primary transition-colors mr-2 shrink-0" />
            <input
              type="text"
              placeholder={t('common:action.search') + '...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-default placeholder:text-muted outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-muted bg-surface rounded border border-(--nav-border) ml-auto shrink-0">
              ⌘K
            </kbd>
          </div>
        </div>

        {isCollapsed && (
          <div className="hidden lg:flex flex-col items-center gap-1.5 pt-2.5 pb-1 shrink-0 px-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-lg text-muted hover:text-primary hover:bg-(--nav-hover-bg) transition-colors cursor-pointer"
              title="Search navigation (click to expand)"
            >
              <Search className="size-4" />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-default scrollbar-track-transparent',
            isCollapsed ? 'lg:px-2 px-3 space-y-4' : 'px-3 space-y-4'
          )}
          aria-label="Main Navigation"
        >
          {navSections.map((section) => {
            const visibleItems = section.items
              .filter((item) => !item.permission || hasPermission(item.permission))
              .filter((item) =>
                searchQuery
                  ? item.label.toLowerCase().includes(searchQuery.toLowerCase())
                  : true
              );

            if (visibleItems.length === 0) return null;

            const isSectionCollapsed = !!collapsedSections[section.title] && !searchQuery;
            const hasActiveChild = section.items.some((item) =>
              isItemActive(item.to, location.pathname === item.to.split('?')[0])
            );

            return (
              <div key={section.title} className="space-y-0.5">
                {/* Section Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    'w-full px-2.5 py-1.5 text-[10px] font-bold tracking-[0.14em] text-(--nav-section-fg) uppercase flex items-center justify-between group hover:text-default rounded-md transition-colors cursor-pointer',
                    isCollapsed && 'lg:hidden'
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={cn("size-1.5 rounded-full shrink-0", getSectionDotTone(section.id))} />
                    <span className="truncate">{t(`sections.${section.id}` as unknown as string, { defaultValue: section.title })}</span>
                    {hasActiveChild && isSectionCollapsed && (
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" title="Active module inside" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      {visibleItems.length}
                    </span>
                    {isSectionCollapsed ? (
                      <ChevronRight className="size-3 text-muted/60" />
                    ) : (
                      <ChevronDown className="size-3 text-muted/60" />
                    )}
                  </div>
                </button>
                {isCollapsed && (
                  <div className="hidden lg:block my-2 border-t border-(--nav-border)/50" />
                )}

                {/* Section Items (hidden if accordion is collapsed and not in icon-rail mode) */}
                {(!isSectionCollapsed || isCollapsed) && (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const itemTransKey = `items.${item.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}` as const;
                      const itemLabel = t(itemTransKey as unknown as string, { defaultValue: item.label });
                      const hasChildren = Boolean(item.children && item.children.length > 0);
                      const isExpanded = Boolean(expandedParents[item.id]);

                      return (
                        <div key={item.id} className="space-y-0.5">
                          <div className="relative flex items-center">
                            <NavLink
                              to={item.to}
                              onClick={(e) => {
                                if (hasChildren) {
                                  const isCurrentlyExpanded = Boolean(expandedParents[item.id]);
                                  if (isCurrentlyExpanded) {
                                    // When expanded, clicking on the module name collapses the sub menu
                                    setExpandedParents((prev) => {
                                      const next = { ...prev, [item.id]: false };
                                      try {
                                        localStorage.setItem('erp_sidebar_expanded_parents', JSON.stringify(next));
                                      } catch (_e) {
                                        void _e;
                                      }
                                      return next;
                                    });

                                    // If already inside this module, prevent full route reload/reset
                                    if (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)) {
                                      e.preventDefault();
                                    }
                                    return;
                                  } else {
                                    // When collapsed, expand the sub menu and let NavLink navigate to default first page
                                    setExpandedParents((prev) => {
                                      const next = { ...prev, [item.id]: true };
                                      try {
                                        localStorage.setItem('erp_sidebar_expanded_parents', JSON.stringify(next));
                                      } catch (_e) {
                                        void _e;
                                      }
                                      return next;
                                    });
                                  }
                                }
                                onClose();
                              }}
                              title={isCollapsed ? itemLabel : undefined}
                              className={({ isActive }) => {
                                const active = isItemActive(item.to, isActive);
                                return cn(
                                  'group flex-1 flex items-center rounded-lg text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary outline-none h-9.5',
                                  isCollapsed
                                    ? 'lg:justify-center justify-between px-3'
                                    : cn('justify-between px-3', hasChildren && !isCollapsed && 'pr-8'),
                                  active
                                    ? 'font-semibold text-primary dark:text-white bg-(--nav-active-bg) border-l-2 border-(--nav-active-marker) shadow-xs'
                                    : 'text-muted hover:text-default hover:bg-(--nav-hover-bg) border-l-2 border-transparent'
                                );
                              }}
                            >
                              {({ isActive }) => {
                                const active = isItemActive(item.to, isActive);
                                return (
                                  <>
                                    <div
                                      className={cn(
                                        'flex items-center gap-2.5 min-w-0',
                                        isCollapsed && 'lg:justify-center'
                                      )}
                                    >
                                      <Icon
                                        className={cn(
                                          'size-4 shrink-0 transition-transform duration-150 group-hover:scale-110',
                                          getParentTone(item.id, active)
                                        )}
                                        aria-hidden="true"
                                      />
                                      <span
                                        className={cn(
                                          'truncate tracking-normal',
                                          isCollapsed && 'lg:hidden'
                                        )}
                                      >
                                        {itemLabel}
                                      </span>
                                    </div>

                                    {item.badge && (
                                      <span
                                        className={cn(
                                          'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 shadow-xs',
                                          isCollapsed && 'lg:hidden',
                                          item.badgeTone === 'success'
                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                            : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                        )}
                                      >
                                        {t(`badges.${item.badge.toLowerCase()}` as unknown as string, { defaultValue: item.badge })}
                                      </span>
                                    )}
                                  </>
                                );
                              }}
                            </NavLink>

                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleParent(item.id, e)}
                                className={cn(
                                  "absolute right-1.5 p-1 rounded-md text-muted hover:text-default hover:bg-surface-sunken/80 transition-colors cursor-pointer z-10",
                                  isCollapsed && "lg:hidden"
                                )}
                                title={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
                                aria-label={isExpanded ? `Collapse ${itemLabel} sub-navigation` : `Expand ${itemLabel} sub-navigation`}
                              >
                                <ChevronDown className={cn("size-3.5 transition-transform duration-200 text-muted/70", !isExpanded && "-rotate-90")} />
                              </button>
                            )}
                          </div>

                          {/* Children Sub-Navigation with purposeful semantic group headings & color highlights */}
                          {hasChildren && isExpanded && !isCollapsed && (
                            <div className="ml-3.5 pl-2 my-1.5 space-y-0.5 border-l border-primary/20 dark:border-primary/30">
                              {item.children?.map((child, idx, arr) => {
                                const prevChild = idx > 0 ? arr[idx - 1] : null;
                                const isNewGroup = Boolean(child.group && (!prevChild || prevChild.group !== child.group));
                                const ChildIcon = child.icon;
                                const isChildActive = isItemActive(child.to, location.pathname === child.to.split('?')[0]);

                                return (
                                  <div key={child.id}>
                                    {isNewGroup && (
                                      <div className={cn(
                                        "px-2 pb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted/70 select-none",
                                        idx > 0 ? "pt-2 border-t border-default/40 mt-1" : "pt-0.5"
                                      )}>
                                        <span className={cn("size-1.5 rounded-full shrink-0 shadow-2xs", getGroupDotTone(child.group))} />
                                        <span className="truncate">{child.group}</span>
                                      </div>
                                    )}
                                    <NavLink
                                      to={child.to}
                                      onClick={onClose}
                                      className={cn(
                                        'group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                                        isChildActive
                                          ? 'font-semibold text-primary dark:text-white bg-(--nav-active-bg) border-l-2 border-primary shadow-2xs'
                                          : 'text-muted hover:text-default hover:bg-(--nav-hover-bg) border-l-2 border-transparent'
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <ChildIcon
                                          className={cn(
                                            'size-3.5 shrink-0 transition-transform group-hover:scale-110',
                                            getChildTone(child.id, isChildActive)
                                          )}
                                        />
                                        <span className="truncate">{child.label || child.defaultLabel}</span>
                                      </div>
                                      {isChildActive && (
                                        <span className="size-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                                      )}
                                    </NavLink>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* PWA Install Button for ERP */}
        {isInstallable && !isInstalled && (
          <div className="px-2 py-1.5 border-t border-(--nav-border) bg-(--nav-bg-deep)/30 shrink-0">
            <button
              type="button"
              onClick={() => promptInstall()}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/25 text-xs font-medium transition cursor-pointer',
                isCollapsed && 'px-1.5'
              )}
              title={i18n.language === 'bn' ? `${erpInstallTitle} অ্যাপ ইনস্টল করুন` : `Install ${erpInstallTitle}`}
            >
              <Download className="size-3.5 shrink-0" />
              {!isCollapsed && (
                <span className="truncate">
                  {i18n.language === 'bn' ? `${erpInstallTitle} ইনস্টল` : `Install ${erpInstallTitle}`}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Desktop & Mobile Sidebar Bottom Footer with Version, Status & DevCenterPoint Branding */}
        <div className="flex flex-col border-t border-(--nav-border) px-3 py-2 bg-(--nav-bg-deep)/50 shrink-0 gap-1 pb-safe">
          <div className={cn('flex flex-col gap-1', isCollapsed && 'lg:hidden')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted/80">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium text-[11px]">{tenantTier}</span>
              </div>
              <span className="text-[9px] font-mono text-muted/60 uppercase">{appVersion}</span>
            </div>
            <div className="text-[10px] text-muted/70 flex items-center justify-between pt-0.5 border-t border-(--nav-border)/40">
              <span className="truncate">{i18n.language === 'bn' ? 'প্রকৌশল:' : 'Engineered by:'}</span>
              <a
                href="https://devcenterpoint.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline transition-colors shrink-0"
              >
                DevCenterPoint
              </a>
            </div>
          </div>
          {isCollapsed && (
            <div className="hidden lg:flex w-full items-center justify-center py-0.5">
              <a
                href="https://devcenterpoint.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Engineered by DevCenterPoint (https://devcenterpoint.com)"
                className="text-[9px] font-mono font-bold text-muted/60 hover:text-primary transition-colors"
              >
                DCP
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}



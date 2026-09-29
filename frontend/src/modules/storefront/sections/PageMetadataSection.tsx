import React from 'react';
import { Trash2, Globe, Lock, Power } from 'lucide-react';
import type { CmsPage } from '../StorefrontPageBuilderWorkspace';

interface PageMetadataSectionProps {
  page: CmsPage;
  onUpdate: (fields: Partial<CmsPage>) => void;
  onDeleteClick: () => void;
  canDelete: boolean;
  onToggleStatus: () => void;
  isToggling?: boolean;
}

export const PageMetadataSection: React.FC<PageMetadataSectionProps> = ({
  page,
  onUpdate,
  onDeleteClick,
  canDelete,
  onToggleStatus,
  isToggling = false,
}) => {
  const isHome = page.slug === 'home';
  const isPublished = page.status === 'published';

  return (
    <div className="rounded-2xl border border-default bg-surface p-5 shadow-2xs space-y-4">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold text-default">Page Configuration & Route</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-muted font-bold">
            ID: {page.id || 'new'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Status Toggle Button */}
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={isToggling}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isPublished
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-zinc-500/10 text-muted border-default hover:bg-zinc-500/20'
            }`}
            title={isPublished ? 'Click to deactivate (unpublish page)' : 'Click to activate (publish live)'}
          >
            <Power className={`size-3.5 ${isPublished ? 'text-emerald-500' : 'text-zinc-400'}`} />
            <span>{isPublished ? 'Active (Live)' : 'Draft (Hidden)'}</span>
          </button>

          {/* Delete Page Button */}
          {canDelete ? (
            <button
              type="button"
              onClick={onDeleteClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-all cursor-pointer"
              title="Delete this page"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Delete Page</span>
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-muted font-mono"
              title="The root homepage is permanent and cannot be deleted"
            >
              <Lock className="size-3 text-muted" />
              <span>Root Page</span>
            </span>
          )}
        </div>
      </div>

      {/* Title and URL Slug Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
            Page Title *
          </label>
          <input
            type="text"
            required
            value={page.title}
            placeholder="e.g. Home, Factory Quality Journey, About Us"
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-xs text-default font-medium focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-1">
            URL Slug Route *
          </label>
          <div className="flex items-center rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs">
            <span className="text-muted font-mono">{isHome ? '/' : '/pages/'}</span>
            <input
              type="text"
              required
              value={page.slug}
              readOnly={isHome}
              placeholder="e.g. about-us"
              onChange={(e) => onUpdate({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              className={`flex-1 bg-transparent text-default focus:outline-none pl-1 font-mono ${
                isHome ? 'cursor-not-allowed opacity-80' : ''
              }`}
            />
          </div>
          {isHome && (
            <p className="text-[10px] text-muted mt-1">
              This page serves as your public storefront root (`/`).
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

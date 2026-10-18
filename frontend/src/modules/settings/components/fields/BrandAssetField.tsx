import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Globe,
  ExternalLink,
  X,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { api } from '../../../../lib/api/client';
import { notify } from '../../../../components/ui/Toast';

interface BrandAssetFieldProps {
  label: string;
  settingKey: string;
  value: string | unknown;
  onChange: (val: string) => void;
  description?: string | undefined;
}

export const BrandAssetField: React.FC<BrandAssetFieldProps> = ({
  label,
  settingKey,
  value,
  onChange,
  description,
}) => {
  const url = typeof value === 'string' ? value : '';
  const isFavicon = settingKey.includes('favicon');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const img = new Image();
    img.src = url;
    img.onload = () => {
      if (active) {
        setLoadedUrl(url);
        setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => {
      if (active) {
        setLoadedUrl(null);
        setImageMeta(null);
      }
    };
    return () => {
      active = false;
      setLoadedUrl(null);
      setImageMeta(null);
    };
  }, [url]);

  const isValid = Boolean(url && loadedUrl === url);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      notify.error('File size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    // Immediate optimistic preview via FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      if (dataUri) {
        onChange(dataUri);
      }
    };
    reader.readAsDataURL(file);

    // Attempt persistent upload to backend storage
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', isFavicon ? 'favicon' : 'logo');

      const res = await api.post<{ url: string; path: string }>('/settings/upload-asset', formData);
      if (res?.data?.url) {
        onChange(res.data.url);
        try {
          if (isFavicon) {
            localStorage.setItem('brand_favicon_url', res.data.url);
          } else {
            localStorage.setItem('brand_logo_url', res.data.url);
          }
        } catch (err) {
          void err;
        }
        notify.success(`${label} uploaded successfully!`);
      }
    } catch {
      // FileReader data URL is already preserved as fallback
      notify.info('Asset saved locally. Remember to click Save Domain.');
    } finally {
      setIsUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // reset input so same file can be picked again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const acceptedTypes = isFavicon
    ? '.ico,.png,.svg,.webp,image/x-icon,image/png,image/svg+xml,image/webp'
    : '.png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp';

  return (
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <div
      role="region"
      aria-label="Brand asset drop zone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'p-4 rounded-xl border bg-surface space-y-3 transition-all',
        isDragging
          ? 'border-primary ring-2 ring-primary/20 bg-primary-subtle'
          : 'border-default hover:border-primary/30'
      )}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept={acceptedTypes}
        className="hidden"
      />

      {/* Header Meta */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
            {isFavicon ? <Globe className="size-4" /> : <Building2 className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-default">{label}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {isFavicon ? 'Browser Tab Favicon' : 'Corporate Logo'}
              </span>
            </div>
            <p className="text-2xs text-muted mt-0.5 line-clamp-1">
              {description ||
                (isFavicon
                  ? 'Browser tab shortcut icon displayed across tabs and mobile home screens.'
                  : 'Primary brand logo displayed across document letterheads, invoices, and web storefront.')}
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        {url ? (
          isValid ? (
            <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircle2 className="size-2.5" />
              {imageMeta ? `${imageMeta.width}×${imageMeta.height}px` : 'Active'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-3xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
              <AlertCircle className="size-2.5" /> Invalid URL
            </span>
          )
        ) : (
          <span className="inline-flex items-center text-3xs font-semibold text-muted bg-surface-sunken border border-default px-2 py-0.5 rounded-full shrink-0">
            No File
          </span>
        )}
      </div>

      {/* Main Interactive Body: Thumbnail + Upload Action Buttons */}
      <div className="flex items-center gap-3.5">
        {/* Visual Thumbnail / Checkerboard Preview Box */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Click to choose a file"
          aria-label="Click to choose a file"
          className={cn(
            'rounded-xl border border-dashed border-default bg-surface-sunken flex items-center justify-center overflow-hidden shrink-0 transition-all cursor-pointer group hover:border-primary hover:bg-primary/5 relative p-0',
            isFavicon ? 'size-14' : 'h-14 w-28'
          )}
          style={{
            backgroundImage:
              'radial-gradient(var(--color-default) 0.5px, transparent 0.5px), radial-gradient(var(--color-default) 0.5px, var(--color-surface-sunken) 0.5px)',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px',
          }}
        >
          {isValid && url ? (
            <img
              src={url}
              alt="Asset Preview"
              className="size-full object-contain p-1.5 transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted group-hover:text-primary transition-colors">
              {isFavicon ? <Globe className="size-6" /> : <Building2 className="size-6" />}
              <span className="text-3xs font-semibold mt-0.5">Upload</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
              <RefreshCw className="size-4 text-primary animate-spin" />
            </div>
          )}
        </button>

        {/* Upload Button, URL Input, and Controls */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-fg hover:bg-primary-hover text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              <span>{url ? 'Upload New File' : 'Upload File'}</span>
            </button>

            {url && (
              <>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-rose-500/10 hover:text-rose-600 border border-default hover:border-rose-500/30 text-xs font-semibold text-muted transition-colors cursor-pointer"
                  title="Remove asset"
                >
                  <X className="size-3" />
                  <span>Remove</span>
                </button>

                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface-sunken border border-default text-xs font-semibold text-muted hover:text-default transition-colors"
                  title="View full asset"
                >
                  <ExternalLink className="size-3" />
                  <span>Open</span>
                </a>
              </>
            )}
          </div>

          {/* URL Input */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={url}
              onChange={(e) => onChange(e.target.value)}
              placeholder={
                isFavicon
                  ? 'https://.../favicon.png or upload'
                  : 'https://.../brand-logo.png or upload'
              }
              className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-1.5 text-xs text-default placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono transition-all"
            />
          </div>

          {/* Format Guidance */}
          <div className="flex items-center justify-between text-3xs text-muted">
            <span className="flex items-center gap-1">
              <ImageIcon className="size-2.5 text-primary" />
              {isFavicon
                ? 'Recommended: 64×64 PNG or ICO'
                : 'Recommended: Transparent SVG or 512×512 PNG'}
            </span>
            <span className="flex items-center gap-1">
              <FileCode className="size-2.5" /> Drag & drop supported
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

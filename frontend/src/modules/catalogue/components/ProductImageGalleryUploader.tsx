import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import {
  Upload,
  Star,
  Trash2,
  Image as ImageIcon,
  ArrowLeft,
  ArrowRight,
  Plus,
  Loader2,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { notify } from '../../../components/ui/Toast';
import type { ProductImage } from '../../../types/api/catalog';

export interface LocalQueuedImage {
  id: string;
  previewUrl: string;
  file?: File;
  url?: string;
  is_primary: boolean;
}

interface ProductImageGalleryUploaderProps {
  productUuid?: string; // If provided, performs live API operations
  existingImages?: ProductImage[];
  primaryImageUrl?: string | null | undefined;
  onPrimaryImageChange?: (url: string) => void;
  // For create mode when product UUID doesn't exist yet:
  queuedImages?: LocalQueuedImage[];
  onQueuedImagesChange?: (images: LocalQueuedImage[]) => void;
}

export function ProductImageGalleryUploader({
  productUuid,
  existingImages = [],
  primaryImageUrl,
  onPrimaryImageChange,
  queuedImages,
  onQueuedImagesChange,
}: ProductImageGalleryUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImage[]>(existingImages);
  const [localQueue, setLocalQueue] = useState<LocalQueuedImage[]>(queuedImages || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const [prevExisting, setPrevExisting] = useState(existingImages);
  const [prevQueued, setPrevQueued] = useState(queuedImages);

  if (existingImages && existingImages !== prevExisting) {
    setPrevExisting(existingImages);
    setImages(existingImages);
  }

  if (queuedImages && queuedImages !== prevQueued) {
    setPrevQueued(queuedImages);
    setLocalQueue(queuedImages);
  }

  // Handle file uploads (multiple files supported)
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      if (!file.type.startsWith('image/')) {
        notify.error(`File "${file.name}" is not a valid image format.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        notify.error(`File "${file.name}" exceeds maximum allowed 10MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (productUuid) {
      // Live API upload mode
      setIsUploading(true);
      let lastUploadedUrl = '';
      try {
        for (const file of validFiles) {
          const formData = new FormData();
          formData.append('image', file);
          if (images.length === 0) {
            formData.append('is_primary', '1');
          }

          const res = await api.post<{ image: ProductImage }>(
            `/products/${productUuid}/images`,
            formData,
            {
              headers: { 'Content-Type': 'multipart/form-data' },
            }
          );

          const newImage = res.data.image;
          setImages((prev) => {
            const next = [...prev, newImage];
            return next;
          });
          lastUploadedUrl = newImage.url;
        }

        if (!primaryImageUrl && lastUploadedUrl && onPrimaryImageChange) {
          onPrimaryImageChange(lastUploadedUrl);
        }
        notify.success(`Successfully uploaded ${validFiles.length} product image(s).`);
      } catch (err) {
        console.error('Image upload failed', err);
        notify.error('Failed to upload image. Please try again.');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Local Queued mode (before product creation)
      const newItems: LocalQueuedImage[] = validFiles.map((file, idx) => ({
        id: `queued_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        previewUrl: URL.createObjectURL(file),
        file,
        is_primary: localQueue.length === 0 && idx === 0,
      }));

      const updated = [...localQueue, ...newItems];
      setLocalQueue(updated);
      onQueuedImagesChange?.(updated);

      if (updated.length > 0 && !primaryImageUrl && onPrimaryImageChange && updated[0]) {
        onPrimaryImageChange(updated[0].previewUrl);
      }
      notify.success(`Added ${validFiles.length} image(s) to product draft.`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add external image URL
  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();

    if (productUuid) {
      setIsAddingUrl(true);
      try {
        const res = await api.post<{ image: ProductImage }>(
          `/products/${productUuid}/images`,
          {
            url,
            is_primary: images.length === 0,
          }
        );
        const newImage = res.data.image;
        setImages((prev) => [...prev, newImage]);
        if (!primaryImageUrl && onPrimaryImageChange) {
          onPrimaryImageChange(newImage.url);
        }
        setUrlInput('');
        notify.success('Linked external image URL successfully.');
      } catch (err) {
        console.error('Failed to link image URL', err);
        notify.error('Could not link image URL.');
      } finally {
        setIsAddingUrl(false);
      }
    } else {
      const newItem: LocalQueuedImage = {
        id: `queued_url_${Date.now()}`,
        previewUrl: url,
        url,
        is_primary: localQueue.length === 0,
      };
      const updated = [...localQueue, newItem];
      setLocalQueue(updated);
      onQueuedImagesChange?.(updated);
      if (updated.length === 1 && onPrimaryImageChange) {
        onPrimaryImageChange(url);
      }
      setUrlInput('');
      notify.success('External image URL added to draft.');
    }
  };

  // Mark Image as Primary
  const handleSetPrimary = async (targetId: number | string) => {
    if (productUuid && typeof targetId === 'number') {
      try {
        await api.post(`/products/${productUuid}/images/${targetId}/primary`);
        setImages((prev) =>
          prev.map((img) => ({
            ...img,
            is_primary: img.id === targetId,
          }))
        );
        const targetImg = images.find((i) => i.id === targetId);
        if (targetImg && onPrimaryImageChange) {
          onPrimaryImageChange(targetImg.url);
        }
        notify.success('Primary product image updated.');
      } catch (err) {
        console.error('Failed to set primary image', err);
        notify.error('Could not update primary image.');
      }
    } else {
      const updated = localQueue.map((item) => ({
        ...item,
        is_primary: item.id === targetId,
      }));
      setLocalQueue(updated);
      onQueuedImagesChange?.(updated);
      const targetItem = updated.find((i) => i.id === targetId);
      if (targetItem && onPrimaryImageChange) {
        onPrimaryImageChange(targetItem.previewUrl);
      }
      notify.success('Primary product image selected.');
    }
  };

  // Delete Image
  const handleDelete = async (targetId: number | string) => {
    if (productUuid && typeof targetId === 'number') {
      try {
        await api.delete(`/products/${productUuid}/images/${targetId}`);
        const updated = images.filter((img) => img.id !== targetId);
        const firstUpdated = updated[0];
        if (images.find((i) => i.id === targetId)?.is_primary && firstUpdated) {
          firstUpdated.is_primary = true;
          if (onPrimaryImageChange) {
            onPrimaryImageChange(firstUpdated.url);
          }
        }
        setImages(updated);
        notify.success('Image removed from catalogue.');
      } catch (err) {
        console.error('Failed to delete image', err);
        notify.error('Could not delete image.');
      }
    } else {
      const updated = localQueue.filter((item) => item.id !== targetId);
      const firstUpdated = updated[0];
      if (localQueue.find((i) => i.id === targetId)?.is_primary && firstUpdated) {
        firstUpdated.is_primary = true;
        if (onPrimaryImageChange) {
          onPrimaryImageChange(firstUpdated.previewUrl);
        }
      }
      setLocalQueue(updated);
      onQueuedImagesChange?.(updated);
      notify.success('Image removed from draft.');
    }
  };

  // Reorder Images (move left/right)
  const handleMove = async (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;

    if (productUuid) {
      if (targetIdx < 0 || targetIdx >= images.length) return;
      const curItem = images[index];
      const targetItem = images[targetIdx];
      if (!curItem || !targetItem) return;

      const reordered = [...images];
      reordered[index] = targetItem;
      reordered[targetIdx] = curItem;
      setImages(reordered);

      try {
        await api.post(`/products/${productUuid}/images/reorder`, {
          order: reordered.map((img) => img.id),
        });
      } catch (err) {
        console.error('Reorder failed', err);
        notify.error('Failed to persist new image order.');
      }
    } else {
      if (targetIdx < 0 || targetIdx >= localQueue.length) return;
      const curItem = localQueue[index];
      const targetItem = localQueue[targetIdx];
      if (!curItem || !targetItem) return;

      const reordered = [...localQueue];
      reordered[index] = targetItem;
      reordered[targetIdx] = curItem;
      setLocalQueue(reordered);
      onQueuedImagesChange?.(reordered);
    }
  };

  // Drag and Drop handlers
  const onDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const displayList = productUuid
    ? images.map((img) => ({
        id: img.id,
        url: img.url,
        is_primary: img.is_primary,
      }))
    : localQueue.map((item) => ({
        id: item.id,
        url: item.previewUrl,
        is_primary: item.is_primary,
      }));

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <button
        type="button"
        aria-label="Upload product images"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full relative border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
          isDragging
            ? 'border-primary bg-primary/10 ring-4 ring-primary/20 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-primary/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          className="hidden"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            {isUploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Upload className="size-6" />
            )}
          </div>

          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-white">
              {isUploading ? 'Uploading Image Assets...' : 'Drag & drop multiple product images here'}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              or{' '}
              <span className="text-primary font-semibold underline inline-flex items-center gap-1">
                browse from computer
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 pt-1">
            <span className="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 font-medium">PNG, JPG, WebP, SVG</span>
            <span>•</span>
            <span>Up to 10MB each</span>
            <span>•</span>
            <span>First photo becomes storefront cover</span>
          </div>
        </div>
      </button>

      {/* Direct Image URL Linker */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            type="url"
            placeholder="https://example.com/cdn/product-photo.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-2xs font-mono"
          />
        </div>
        <button
          type="button"
          onClick={handleAddUrl}
          disabled={!urlInput.trim() || isAddingUrl}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
        >
          {isAddingUrl ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          <span>Add URL</span>
        </button>
      </div>

      {/* Gallery Grid */}
      {displayList.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Product Image Gallery ({displayList.length})
            </span>
            <span className="text-[11px]">
              Star icon sets the main catalogue cover photo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayList.map((item, idx) => (
              <div
                key={item.id}
                className={`relative group rounded-2xl overflow-hidden border transition-all ${
                  item.is_primary
                    ? 'border-amber-400/80 ring-2 ring-amber-400/30 shadow-md bg-amber-50/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-900/5 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Image Aspect Box */}
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                  <img
                    src={item.url || '/assets/placeholder-product.svg'}
                    alt={`Product angle ${idx + 1}`}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Primary Badge */}
                  {item.is_primary && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md">
                      <Star className="size-3 fill-white" />
                      <span>Primary</span>
                    </div>
                  )}

                  {/* Order Number Badge */}
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-mono font-bold">
                    #{idx + 1}
                  </div>

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex items-center justify-between">
                      {/* Set Primary Button */}
                      {!item.is_primary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(item.id)}
                          className="px-2 py-1 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 transition-transform active:scale-95 cursor-pointer shadow-sm"
                          title="Set as Main Cover Image"
                        >
                          <Star className="size-3" />
                          <span>Make Primary</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white transition-colors cursor-pointer ml-auto shadow-sm"
                        title="Delete Image"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {/* Order Controls */}
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'left')}
                        className="size-7 rounded-lg bg-white/20 hover:bg-white/40 disabled:opacity-30 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Move Left"
                      >
                        <ArrowLeft className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === displayList.length - 1}
                        onClick={() => handleMove(idx, 'right')}
                        className="size-7 rounded-lg bg-white/20 hover:bg-white/40 disabled:opacity-30 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Move Right"
                      >
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <ImageIcon className="size-5 text-slate-400 shrink-0" />
          <p>
            No images uploaded yet. Upload high-definition photos or multiple angles (front, back, label, packaging) to give e-commerce customers full visual confidence.
          </p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Calendar,
  User
} from 'lucide-react';
import {
  fetchFileBlob,
  revokeFileBlobUrl,
  deleteStorageFile,
  type StorageFile
} from '../../services/storageService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PillButton } from '../ui/hyperos';

export interface DriveFilePreviewModalProps {
  file: StorageFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: (fileId: string) => void;
}

export const DriveFilePreviewModal: React.FC<DriveFilePreviewModalProps> = ({
  file,
  isOpen,
  onClose,
  onDeleted
}) => {
  const { currentLanguage } = useLanguage();
  const { isMasterAdmin, membership } = useWorkspace();
  const isBn = currentLanguage === 'bn';

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !file) {
      if (previewUrl) {
        revokeFileBlobUrl(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchFileBlob(file.id, 'preview')
      .then(({ objectUrl }) => {
        if (isMounted) {
          setPreviewUrl(objectUrl);
          setLoading(false);
        } else {
          revokeFileBlobUrl(objectUrl);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching file preview blob:', err);
          setError(err?.message || (isBn ? 'ফাইল লোড করা সম্ভব হয়নি' : 'Failed to load file preview'));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (previewUrl) {
        revokeFileBlobUrl(previewUrl);
      }
    };
  }, [isOpen, file?.id]);

  if (!isOpen || !file) return null;

  const isPdf = file.mimeType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
  const isImage = file.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.fileName);

  const canDelete = isMasterAdmin || (membership && file.uploadedBy === membership.uid);

  const handleDownload = async () => {
    try {
      const { objectUrl } = await fetchFileBlob(file.id, 'download');
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.originalFileName || file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => revokeFileBlobUrl(objectUrl), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(isBn ? `ডাউনলোড ব্যর্থ: ${msg}` : `Download failed: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    if (!confirm(isBn ? 'আপনি কি নিশ্চিতভাবে এই ডকুমেন্টটি ডিলিট করতে চান?' : 'Are you sure you want to delete this document?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteStorageFile(file.id);
      if (onDeleted) onDeleted(file.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(isBn ? `ডিলিট ব্যর্থ: ${msg}` : `Delete failed: ${msg}`);
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--hyper-surface)] border border-[var(--hyper-border-subtle)] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface-elevated)]">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1685E8] flex items-center justify-center shrink-0">
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[var(--hyper-text-primary)] truncate">
                {file.originalFileName || file.fileName}
              </h3>
              <p className="text-[11px] text-[var(--hyper-text-secondary)] flex items-center gap-2 mt-0.5">
                <span>{formatFileSize(file.fileSize)}</span>
                <span>•</span>
                <span className="capitalize">{file.category.replace(/_/g, ' ')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PillButton size="sm" variant="secondary" onClick={handleDownload} title={isBn ? 'ডাউনলোড' : 'Download'}>
              <Download className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">{isBn ? 'ডাউনলোড' : 'Download'}</span>
            </PillButton>

            {canDelete && (
              <PillButton size="sm" variant="danger" onClick={handleDelete} disabled={isDeleting} title={isBn ? 'ডিলিট' : 'Delete'}>
                <Trash2 className="w-4 h-4" />
              </PillButton>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-[350px] max-h-[calc(90vh-140px)] p-4 overflow-auto flex items-center justify-center bg-black/[0.02] dark:bg-black/20">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-[#1685E8] animate-spin" />
              <p className="text-xs text-[var(--hyper-text-secondary)]">
                {isBn ? 'গুগল ড্রাইভ থেকে ফাইল প্রিভিউ তৈরি হচ্ছে...' : 'Streaming private preview from Google Drive...'}
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 text-center p-6 max-w-md">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
              <PillButton size="sm" variant="secondary" onClick={handleDownload} className="mt-2">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {isBn ? 'ডাউনলোড করে দেখুন' : 'Download to view'}
              </PillButton>
            </div>
          )}

          {!loading && !error && previewUrl && (
            <div className="w-full h-full flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={previewUrl}
                  title={file.fileName}
                  className="w-full h-[60vh] rounded-2xl border border-[var(--hyper-border-subtle)]"
                />
              ) : isImage ? (
                <img
                  src={previewUrl}
                  alt={file.fileName}
                  className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-md"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-12 h-12 text-[var(--hyper-text-tertiary)] mx-auto" />
                  <p className="text-xs text-[var(--hyper-text-secondary)]">
                    {isBn
                      ? 'এই ফাইল ফরম্যাট সরাসরি প্রিভিউ করা সম্ভব নয়। দেখার জন্য ডাউনলোড করুন।'
                      : 'Direct preview is not available for this file type. Please download to view.'}
                  </p>
                  <PillButton size="sm" variant="primary" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {isBn ? 'ডাউনলোড' : 'Download'}
                  </PillButton>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="px-5 py-3 border-t border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] flex flex-wrap items-center justify-between text-[11px] text-[var(--hyper-text-tertiary)] gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'N/A'}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {file.uploadedBy || 'Admin'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            🔒 Private Google Drive Storage (No Public Links)
          </span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  Plus,
  Cloud,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import {
  listStorageFiles,
  type StorageFile,
  type StorageCategory,
  fetchFileBlob,
  revokeFileBlobUrl
} from '../../services/storageService';
import { StorageFileUpload } from './StorageFileUpload';
import { StorageFilePreviewModal } from './StorageFilePreviewModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { PillButton } from '../ui/hyperos';

export interface StorageDocumentListProps {
  tenantId?: string;
  propertyId?: string;
  category?: StorageCategory;
  defaultUploadCategory?: StorageCategory;
  title?: string;
  className?: string;
}

export const StorageDocumentList: React.FC<StorageDocumentListProps> = ({
  tenantId,
  propertyId,
  category,
  defaultUploadCategory = 'nid',
  title,
  className = ''
}) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const data = await listStorageFiles({
        category,
        tenantId,
        propertyId
      });
      setFiles(data.sort((left, right) =>
        new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error loading stored documents:', err);
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [category, tenantId, propertyId]);

  useEffect(() => {
    const load = async () => {
      await Promise.resolve();
      await loadFiles();
    };
    void load();
  }, [loadFiles]);

  const handleDownload = async (file: StorageFile, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-[var(--hyper-text-primary)] flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[#1685E8]" />
          <span>{title || (isBn ? 'ক্লাউড ডকুমেন্টস' : 'Cloud Documents')}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-[#1685E8]">
            {files.length}
          </span>
        </h4>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void loadFiles();
            }}
            disabled={loading}
            className="p-1.5 rounded-lg text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50"
            title={isBn ? 'রিফ্রেশ' : 'Refresh'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <PillButton
            size="sm"
            variant={showUpload ? 'secondary' : 'primary'}
            onClick={() => setShowUpload(!showUpload)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>{showUpload ? (isBn ? 'বাতিল' : 'Cancel') : (isBn ? 'নতুন ডকুমেন্ট' : 'Upload File')}</span>
          </PillButton>
        </div>
      </div>

      {/* Upload Drawer */}
      {showUpload && (
        <div className="p-3.5 rounded-2xl bg-[var(--hyper-surface-elevated)] border border-[var(--hyper-border-subtle)] animate-in fade-in duration-150">
          <StorageFileUpload
            category={defaultUploadCategory}
            tenantId={tenantId}
            propertyId={propertyId}
            label={isBn ? 'ডকুমেন্ট আপলোড করুন' : 'Upload Document'}
            description={isBn ? 'ফাইল ব্যক্তিগত Cloudflare R2-তে সংরক্ষণ করুন' : 'Private Cloudflare R2 storage'}
            onUploadSuccess={(newFile) => {
              setFiles((prev) => [newFile, ...prev]);
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* File List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-[var(--hyper-text-tertiary)] flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{isBn ? 'লোড হচ্ছে...' : 'Loading files...'}</span>
        </div>
      ) : loadError ? (
        <div className="space-y-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-center">
          <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {isBn ? `ডকুমেন্ট লোড করা যায়নি: ${loadError}` : `Documents could not be loaded: ${loadError}`}
          </p>
          <PillButton size="sm" variant="secondary" onClick={() => {
            setLoading(true);
            setLoadError(null);
            void loadFiles();
          }}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {isBn ? 'আবার চেষ্টা করুন' : 'Try again'}
          </PillButton>
        </div>
      ) : files.length === 0 ? (
        <div className="py-6 text-center rounded-2xl border border-dashed border-[var(--hyper-border-subtle)] p-4 space-y-1">
          <FolderOpen className="w-6 h-6 text-[var(--hyper-text-tertiary)] mx-auto opacity-60" />
          <p className="text-xs text-[var(--hyper-text-secondary)] font-medium">
            {isBn ? 'কোনো ডকুমেন্ট সংরক্ষিত নেই' : 'No documents attached'}
          </p>
          <p className="text-[10px] text-[var(--hyper-text-tertiary)]">
            {isBn ? 'নতুন ফাইল ব্যক্তিগত Cloudflare R2-তে সংরক্ষিত হবে' : 'New files are stored privately in Cloudflare R2'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const isPdf = file.mimeType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
            return (
              <div
                key={file.id}
                onClick={() => setSelectedFile(file)}
                className="p-3 rounded-2xl bg-[var(--hyper-surface-elevated)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-[var(--hyper-border-subtle)] flex items-center justify-between gap-3 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#1685E8] flex items-center justify-center shrink-0">
                    {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--hyper-text-primary)] truncate group-hover:text-[#1685E8] transition-colors">
                      {file.originalFileName || file.fileName}
                    </p>
                    <p className="text-[10px] text-[var(--hyper-text-tertiary)] flex items-center gap-2 mt-0.5">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>•</span>
                      <span className="capitalize">{file.category.replace(/_/g, ' ')}</span>
                      {file.uploadedAt && (
                        <>
                          <span>•</span>
                          <span>
                            {new Date(file.uploadedAt).toLocaleString(isBn ? 'bn-BD' : 'en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleDownload(file, e)}
                    className="p-1.5 rounded-lg text-[var(--hyper-text-secondary)] hover:text-[#1685E8] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    title={isBn ? 'ডাউনলোড' : 'Download'}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(file)}
                    className="p-1.5 rounded-lg text-[var(--hyper-text-secondary)] hover:text-[#1685E8] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    title={isBn ? 'প্রিভিউ' : 'Preview'}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <StorageFilePreviewModal
        file={selectedFile}
        isOpen={Boolean(selectedFile)}
        onClose={() => setSelectedFile(null)}
        onDeleted={(fileId) => {
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          setSelectedFile(null);
        }}
      />
    </div>
  );
};

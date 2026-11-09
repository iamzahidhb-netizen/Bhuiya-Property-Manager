import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  X
} from 'lucide-react';
import {
  uploadStorageFile,
  type StorageCategory,
  type StorageFile
} from '../../services/storageService';
import { DriveFilePreviewModal } from './DriveFilePreviewModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { PillButton } from '../ui/hyperos';

export interface DriveFileUploadProps {
  category: StorageCategory;
  tenantId?: string;
  propertyId?: string;
  label?: string;
  description?: string;
  acceptedTypes?: string;
  onUploadSuccess?: (file: StorageFile) => void;
  className?: string;
}

export const DriveFileUpload: React.FC<DriveFileUploadProps> = ({
  category,
  tenantId,
  propertyId,
  label,
  description,
  acceptedTypes = '.pdf,image/jpeg,image/png,image/webp',
  onUploadSuccess,
  className = ''
}) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<StorageFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    // 25MB validation
    if (file.size > 25 * 1024 * 1024) {
      setError(isBn ? 'ফাইলের আকার ২৫ মেগাবাইটের বেশি হতে পারবে না।' : 'File size cannot exceed 25MB.');
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      const result = await uploadStorageFile({
        file: selectedFile,
        category,
        tenantId,
        propertyId,
        onProgress: (p) => setProgress(p)
      });

      setUploadedFile(result);
      setSelectedFile(null);
      setProgress(100);
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || (isBn ? 'আপলোড ব্যর্থ হয়েছে।' : 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Optional Label */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--hyper-text-primary)]">
            {label}
          </label>
          {description && (
            <span className="text-[11px] text-[var(--hyper-text-tertiary)]">
              {description}
            </span>
          )}
        </div>
      )}

      {/* Hidden Native Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Zone */}
      {!uploadedFile && !selectedFile && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-150 ${
            isDragOver
              ? 'border-[#1685E8] bg-blue-500/10'
              : 'border-[var(--hyper-border-subtle)] hover:border-[#1685E8]/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1685E8] flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--hyper-text-primary)]">
                {isBn ? 'ফাইল নির্বাচন করতে ক্লিক করুন বা টেনে আনুন' : 'Click to select or drag & drop'}
              </p>
              <p className="text-[10px] text-[var(--hyper-text-tertiary)] mt-0.5">
                PDF, JPG, PNG, WEBP (Max 25MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected File Stage (Ready to upload) */}
      {selectedFile && !uploadedFile && (
        <div className="p-3 rounded-2xl bg-[var(--hyper-surface-elevated)] border border-[var(--hyper-border-subtle)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#1685E8] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--hyper-text-primary)] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-[var(--hyper-text-tertiary)]">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            {!uploading && (
              <button
                type="button"
                onClick={resetSelection}
                className="p-1 rounded-lg text-[var(--hyper-text-tertiary)] hover:text-rose-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1685E8] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--hyper-text-tertiary)] text-right">
                {isBn ? `আপলোড হচ্ছে (${progress}%)...` : `Uploading (${progress}%)...`}
              </p>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="flex items-center gap-2 text-[11px] text-rose-500 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Button */}
          {!uploading && (
            <div className="flex justify-end gap-2 pt-1">
              <PillButton size="sm" variant="secondary" onClick={resetSelection}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </PillButton>
              <PillButton size="sm" variant="primary" onClick={startUpload}>
                <UploadCloud className="w-3.5 h-3.5 mr-1" />
                {isBn ? 'গুগল ড্রাইভে আপলোড' : 'Upload to Drive'}
              </PillButton>
            </div>
          )}
        </div>
      )}

      {/* Uploaded File Pill (Success State) */}
      {uploadedFile && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--hyper-text-primary)] truncate">
                {uploadedFile.originalFileName || uploadedFile.fileName}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {isBn ? '✓ ড্রাইভে সুরক্ষিত' : '✓ Stored on Drive'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="p-1.5 rounded-lg text-[var(--hyper-text-secondary)] hover:text-[#1685E8] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title={isBn ? 'দেখুন' : 'View'}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadedFile(null);
                resetSelection();
              }}
              className="p-1.5 rounded-lg text-[var(--hyper-text-tertiary)] hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title={isBn ? 'নতুন ফাইল' : 'Replace file'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* In-App Preview Modal */}
      <DriveFilePreviewModal
        file={uploadedFile}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onDeleted={() => {
          setUploadedFile(null);
          resetSelection();
        }}
      />
    </div>
  );
};

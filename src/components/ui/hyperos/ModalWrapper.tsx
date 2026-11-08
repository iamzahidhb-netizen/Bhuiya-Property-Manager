import React, { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { PillButton } from './PillButton';

export interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  formId?: string;
  submitText?: string;
  cancelText?: string;
  onSubmit?: (e: React.FormEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

/**
 * ModalWrapper: Shared Xiaomi HyperOS inspired modal sheet container.
 * Features fixed backdrop blur, 32px rounded corners, pinned header,
 * scrollable body, and pinned footer with safe-area support.
 */
export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = 'lg',
  children,
  footer,
  formId,
  submitText,
  cancelText = 'বাতিল / Cancel',
  onSubmit,
  loading = false,
  disabled = false,
  className = '',
}) => {
  // Lock background scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 hyper-modal-scrim overflow-y-auto overscroll-contain animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full ${maxWidthMap[maxWidth]} hyper-modal-sheet rounded-[32px] border border-[var(--hyper-border)] flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in zoom-in-95 duration-150 ${className}`}
      >
        {/* Fixed / Sticky Header */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 hyper-modal-header select-none">
          <div className="min-w-0 pr-3">
            <h3 className="text-base sm:text-lg font-bold text-[var(--hyper-text-primary)] tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 text-[var(--hyper-text-primary)]">
          {children}
        </div>

        {/* Pinned / Sticky Footer */}
        {(footer || submitText) && (
          <div className="shrink-0 flex items-center justify-end gap-3 p-4 sm:p-6 hyper-modal-footer pb-[calc(env(safe-area-inset-bottom)+1rem)] select-none">
            {footer ? (
              footer
            ) : (
              <>
                <PillButton
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                  disabled={loading}
                >
                  {cancelText}
                </PillButton>
                {submitText && (
                  <PillButton
                    variant="primary"
                    size="md"
                    type={formId ? 'submit' : 'button'}
                    form={formId}
                    onClick={!formId ? onSubmit : undefined}
                    disabled={disabled || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        <span>সংরক্ষণ হচ্ছে...</span>
                      </>
                    ) : (
                      submitText
                    )}
                  </PillButton>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalWrapper;

import React, { useState, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAppNavigation } from '../../../contexts/NavigationContext';

export interface FrostedGlassOption<T extends string = string> {
  value: T;
  labelBn: string;
  labelEn: string;
  descriptionBn?: string;
  descriptionEn?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  disabled?: boolean;
}

export interface FrostedGlassSelectProps<T extends string = string> {
  id?: string;
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: FrostedGlassOption<T>[];
  titleBn: string;
  titleEn: string;
  subtitleBn?: string;
  subtitleEn?: string;
  headerIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  headerIconBg?: string;
  headerIconColor?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  modalTestId?: string;
  triggerTestId?: string;
  confirmTestId?: string;
  cancelTestId?: string;
  instantSelect?: boolean;
  compact?: boolean;
  renderTrigger?: (
    selectedOption: FrostedGlassOption<T> | undefined,
    open: () => void,
    isOpen: boolean
  ) => React.ReactNode;
}

/**
 * Xiaomi HyperOS Inspired Frosted Glass Selection Component.
 * Features:
 * - Real glassmorphism with blur(24px) saturate(160%)
 * - Dark & light theme responsive via CSS variables
 * - Single selection with radio-style indicators
 * - Android & browser Back button integration via registerBackGuard
 * - Keyboard navigation (Escape, Enter, Space) and outside-click dismissal
 */
export function FrostedGlassSelect<T extends string = string>({
  id: explicitId,
  name,
  value,
  onChange,
  options,
  titleBn,
  titleEn,
  subtitleBn,
  subtitleEn,
  headerIcon: HeaderIcon,
  headerIconBg = 'bg-[#22B84A]/15',
  headerIconColor = 'text-[#22B84A]',
  placeholder,
  disabled = false,
  className = '',
  triggerClassName = '',
  modalTestId,
  triggerTestId,
  confirmTestId,
  cancelTestId,
  instantSelect = false,
  compact = false,
  renderTrigger,
}: FrostedGlassSelectProps<T>) {
  const generatedId = useId();
  const selectId = explicitId || generatedId;
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [isOpen, setIsOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<T>(value);
  const [prevValue, setPrevValue] = useState<T>(value);

  // Sync internal pending state when value changes externally
  if (value !== prevValue) {
    setPrevValue(value);
    setPendingValue(value);
  }

  // Back guard integration for Android Chrome back gesture/button
  let registerBackGuard: ReturnType<typeof useAppNavigation>['registerBackGuard'] | undefined;
  try {
    const nav = useAppNavigation();
    registerBackGuard = nav.registerBackGuard;
  } catch {
    // Safely fallback if rendered outside NavigationContext
  }

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setPendingValue(value);
    setIsOpen(true);
  }, [disabled, value]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPendingValue(value);
  }, [value]);

  const handleConfirm = useCallback(() => {
    onChange(pendingValue);
    setIsOpen(false);
  }, [onChange, pendingValue]);

  const handleOptionClick = useCallback(
    (optValue: T, optDisabled?: boolean) => {
      if (optDisabled) return;
      if (instantSelect) {
        onChange(optValue);
        setIsOpen(false);
      } else {
        setPendingValue(optValue);
      }
    },
    [instantSelect, onChange]
  );

  // Register back guard when popup is open
  useEffect(() => {
    if (isOpen && registerBackGuard) {
      return registerBackGuard({
        id: `frosted-select-guard-${selectId}`,
        isDirty: () => true,
        onBlocked: () => {
          handleClose();
        },
      });
    }
  }, [isOpen, registerBackGuard, selectId, handleClose]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} data-frosted-select-id={selectId}>
      {/* Hidden standard input for HTML form accessibility & test selectors */}
      <input
        type="hidden"
        id={selectId}
        name={name}
        value={value}
        aria-hidden="true"
      />

      {/* Trigger Button */}
      {renderTrigger ? (
        renderTrigger(selectedOption, handleOpen, isOpen)
      ) : (
        <button
          type="button"
          id={`${selectId}-trigger`}
          data-testid={triggerTestId || `${selectId}-trigger`}
          onClick={handleOpen}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`w-full ${
            compact ? 'h-10 px-2.5 py-1 rounded-xl text-xs' : 'rounded-2xl px-4 py-3 text-sm'
          } border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] font-medium text-[var(--hyper-text-primary)] flex items-center justify-between hover:border-[#22B84A] dark:hover:border-[#22B84A] focus:ring-2 focus:ring-[#22B84A]/20 transition cursor-pointer text-left select-none group disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {selectedOption?.icon && (
              <div
                className={`${
                  compact ? 'w-6 h-6 rounded-lg' : 'w-8 h-8 rounded-xl'
                } ${
                  selectedOption.iconBg || 'bg-[#22B84A]/10'
                } ${
                  selectedOption.iconColor || 'text-[#22B84A]'
                } flex items-center justify-center shrink-0 shadow-2xs`}
              >
                {React.createElement(selectedOption.icon, {
                  className: compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
                  strokeWidth: 2.2,
                })}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className={`font-bold text-[var(--hyper-text-primary)] truncate block leading-tight ${
                compact ? 'text-xs' : 'text-sm'
              }`}>
                {selectedOption
                  ? isBn
                    ? selectedOption.labelBn
                    : selectedOption.labelEn
                  : placeholder || (isBn ? 'নির্বাচন করুন' : 'Select')}
              </span>
              {selectedOption && (
                <span className={`text-[var(--hyper-text-secondary)] truncate block leading-tight ${
                  compact ? 'text-[9.5px]' : 'text-[11px]'
                }`}>
                  {isBn ? selectedOption.labelEn : selectedOption.labelBn}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className={`${
            compact ? 'w-3.5 h-3.5 ml-1.5' : 'w-4 h-4 ml-2'
          } text-[var(--hyper-text-tertiary)] group-hover:text-[var(--hyper-text-primary)] transition-transform shrink-0`} />
        </button>
      )}

      {/* Frosted Glass Modal Overlay */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${selectId}-title`}
            data-testid={modalTestId || `${selectId}-modal`}
            data-frosted-popup="true"
            onClick={handleClose}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/40 dark:bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
          >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-[28px] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            style={{
              background: 'var(--hyper-glass-popup-bg, rgba(255, 255, 255, 0.75))',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              border: '1px solid var(--hyper-glass-popup-border, rgba(255, 255, 255, 0.65))',
              boxShadow: 'var(--hyper-glass-popup-shadow, 0 16px 48px rgba(0, 0, 0, 0.16))',
            }}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-[var(--hyper-border-subtle)]/60">
              <div className="flex items-center gap-3">
                {HeaderIcon && (
                  <div
                    className={`w-10 h-10 rounded-2xl ${headerIconBg} ${headerIconColor} flex items-center justify-center shrink-0 shadow-2xs`}
                  >
                    <HeaderIcon className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                )}
                <div>
                  <h3
                    id={`${selectId}-title`}
                    className="text-base sm:text-lg font-bold text-[var(--hyper-text-primary)] leading-tight"
                  >
                    {isBn ? titleBn : titleEn}
                  </h3>
                  {(subtitleBn || subtitleEn) && (
                    <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
                      {isBn ? subtitleBn || subtitleEn : subtitleEn || subtitleBn}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                data-testid={`${selectId}-close-btn`}
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] flex items-center justify-center transition cursor-pointer select-none"
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Option Radio List */}
            <div
              className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 overscroll-contain"
              role="radiogroup"
              aria-labelledby={`${selectId}-title`}
            >
              {options.map((opt) => {
                const isSelected = pendingValue === opt.value;
                const OptIcon = opt.icon;

                return (
                  <div
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={opt.disabled}
                    tabIndex={opt.disabled ? -1 : 0}
                    data-option-value={opt.value}
                    data-testid={`option-${opt.value}`}
                    onClick={() => handleOptionClick(opt.value, opt.disabled)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOptionClick(opt.value, opt.disabled);
                      }
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-150 select-none group ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed border-transparent'
                        : isSelected
                        ? 'bg-[#22B84A]/12 border-[#22B84A]/40 shadow-xs cursor-pointer'
                        : 'bg-white/40 dark:bg-white/5 border-white/50 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 text-[var(--hyper-text-primary)] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {OptIcon && (
                        <div
                          className={`w-9 h-9 rounded-xl ${
                            opt.iconBg || 'bg-[#22B84A]/10'
                          } ${
                            opt.iconColor || 'text-[#22B84A]'
                          } flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105`}
                        >
                          <OptIcon className="w-4 h-4" strokeWidth={2.2} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-[var(--hyper-text-primary)] truncate">
                            {isBn ? opt.labelBn : opt.labelEn}
                          </span>
                          {opt.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22B84A] text-white shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--hyper-text-secondary)] truncate">
                          {isBn ? opt.labelEn : opt.labelBn}
                        </div>
                        {(opt.descriptionBn || opt.descriptionEn) && (
                          <div className="text-[10px] text-[var(--hyper-text-tertiary)] mt-0.5 leading-snug">
                            {isBn
                              ? opt.descriptionBn || opt.descriptionEn
                              : opt.descriptionEn || opt.descriptionBn}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Radio Button Indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-all ${
                        isSelected
                          ? 'border-[#22B84A] bg-[#22B84A] text-white shadow-xs'
                          : 'border-slate-300 dark:border-white/30 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions Footer */}
            <div className="shrink-0 flex items-center justify-between gap-3 p-4 sm:p-5 border-t border-[var(--hyper-border-subtle)]/60 bg-white/30 dark:bg-black/20">
              <button
                type="button"
                data-testid={cancelTestId || `${selectId}-cancel-btn`}
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] font-semibold text-xs transition cursor-pointer select-none"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid={confirmTestId || `${selectId}-confirm-btn`}
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-2xl bg-[#22B84A] hover:bg-[#1faa43] text-white font-bold text-xs shadow-md shadow-[#22B84A]/25 transition cursor-pointer select-none flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" strokeWidth={2.4} />
                <span>{isBn ? 'বাছাই সম্পন্ন' : 'Confirm Selection'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default FrostedGlassSelect;

import React from 'react';
import { ArrowLeft, Files } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { StorageDocumentList } from './StorageDocumentList';

export interface StorageLibraryPageProps {
  onBack: () => void;
}

export const StorageLibraryPage: React.FC<StorageLibraryPageProps> = ({ onBack }) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  return (
    <main className="min-h-screen bg-[var(--hyper-bg-base)] px-4 pb-28 pt-5 text-[var(--hyper-text-primary)] sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center gap-3 border-b border-[var(--hyper-border-subtle)] pb-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl p-2 text-[var(--hyper-text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--hyper-text-primary)]"
            aria-label={isBn ? 'ফিরে যান' : 'Back'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-[#1685E8]">
            <Files className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold sm:text-xl">{isBn ? 'ডকুমেন্ট' : 'Documents'}</h1>
          </div>
        </header>

        <section className="rounded-3xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] p-4 shadow-sm sm:p-6">
          <StorageDocumentList
            defaultUploadCategory="property_document"
            title={isBn ? 'সব ডকুমেন্ট' : 'All Documents'}
          />
        </section>
      </div>
    </main>
  );
};

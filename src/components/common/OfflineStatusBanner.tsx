import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

/**
 * Visual banner displayed across the top of the viewport when offline.
 */
export const OfflineStatusBanner: React.FC = () => {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="no-print bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between z-50 text-xs sm:text-sm font-medium sticky top-0">
      <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
        <svg className="w-5 h-5 shrink-0 text-amber-200 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div className="flex-1">
          <span className="font-bold underline">সিস্টেম নোটিশ:</span> আপনি বর্তমানে অফলাইনে আছেন। আর্থিক নিরাপত্তা ও দ্বৈত-এন্ট্রি রোধে অফলাইনে কোনো লেনদেন (ভাড়া আদায়, খরচ এন্ট্রি, পারিবারিক বণ্টন) সম্পন্ন করা যাবে না। ইন্টারনেট সংযোগ স্বাভাবিক হলে স্বয়ংক্রিয়ভাবে চালু হবে।
        </div>
        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-amber-700/80 text-[11px] font-mono shrink-0">
          OFFLINE READ-ONLY
        </span>
      </div>
    </div>
  );
};

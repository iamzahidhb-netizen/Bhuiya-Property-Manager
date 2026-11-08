import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/40 to-slate-100 p-4">
      {/* Official AB Logo */}
      <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center mb-6 shadow-lg shadow-emerald-700/15 border border-emerald-100 overflow-hidden">
        <img
          src="/brand/anwar-bhuiyan-property.svg"
          alt="Anwar Bhuiyan Property Logo"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Spinner */}
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />

      {/* Bilingual Text */}
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-slate-800">আনোয়ার ভূঁইয়া প্রপার্টি</p>
        <p className="text-xs text-slate-500 font-medium">লোড হচ্ছে... / Loading...</p>
      </div>
    </div>
  );
}
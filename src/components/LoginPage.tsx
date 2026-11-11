import { useState, type FormEvent } from 'react';
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type AuthError,
} from 'firebase/auth';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  LogIn,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { LiquidGlass } from './ui/LiquidGlass';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSelector } from './common/LanguageSelector';

/** Map Firebase Auth error codes to user-friendly Bangla/English messages. */
function getErrorMessage(error: AuthError, isBengali: boolean): string {
  switch (error.code) {
    case 'auth/invalid-email':
      return isBengali
        ? 'ইমেইল ঠিকানা সঠিক নয়।'
        : 'Invalid email address.';
    case 'auth/user-disabled':
      return isBengali
        ? 'এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।'
        : 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return isBengali
        ? 'ভুল ইমেইল বা পাসওয়ার্ড প্রদান করা হয়েছে।'
        : 'Incorrect email or password.';
    case 'auth/unauthorized-domain':
      return isBengali
        ? 'অনুমোদিত ডোমেন নয়। Firebase কনসোলে এই ডোমেনটি যোগ করুন।'
        : 'Unauthorized domain.';
    case 'auth/too-many-requests':
      return isBengali
        ? 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
        : 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return isBengali
        ? 'নেটওয়ার্ক সমস্যা। ইন্টারনেট সংযোগ পরীক্ষা করুন।'
        : 'Network error. Check your internet connection.';
    default:
      return isBengali
        ? 'লগইন করা যায়নি। আবার চেষ্টা করুন।'
        : 'Login failed. Please try again.';
  }
}

export default function LoginPage() {
  const { t, isBengali } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Staging helper removed as per user instruction ("এইটা টোটাল বাদ দেও")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(isBengali ? 'ইউজারনেম বা ইমেইল প্রদান করুন।' : 'Please enter your username or email.');
      return;
    }
    if (!password) {
      setError(isBengali ? 'পাসওয়ার্ড প্রদান করুন।' : 'Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const loginEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@bhuiyan.com`;
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (err) {
      const authError = err as AuthError;
      console.warn('[Login] Authentication rejected:', authError.code, authError.message);
      setError(getErrorMessage(authError, isBengali));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start sm:justify-center ambient-emerald-bg px-4 py-3 sm:py-8 relative overflow-y-auto antialiased">
      {/* Dynamic Ambient Background Highlights for real refraction bending */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-12 left-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-200/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Official AB Logo Watermark in Background as requested */}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="relative w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] opacity-[0.09] filter drop-shadow-sm pointer-events-none transform -rotate-3 scale-105">
          <img
            src="/brand/anwar-bhuiyan-property.svg"
            alt=""
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>
      </div>

      <div className="relative w-full max-w-md z-10 my-auto py-2 sm:py-4 pb-24 sm:pb-6">
        {/* Apple-style Liquid Glass Card with real refraction */}
        <LiquidGlass
          className="p-5 sm:p-10 border border-white/60 shadow-2xl relative overflow-hidden rounded-3xl"
          scale={-120}
          chroma={7}
          blur={10}
          saturate={1.4}
        >
          {/* Subtle Branded Corner Watermark inside Glass Card */}
          <div
            className="absolute -right-10 -bottom-10 w-44 h-44 opacity-[0.045] pointer-events-none overflow-hidden select-none"
            aria-hidden="true"
          >
            <img
              src="/brand/anwar-bhuiyan-property.svg"
              alt=""
              className="w-full h-full object-contain filter grayscale"
            />
          </div>

          {/* Language Selector Header */}
          <div className="flex justify-end mb-2 sm:mb-4 relative z-10">
            <LanguageSelector compact />
          </div>

          {/* Header & Official Branding */}
          <div className="text-center mb-4 sm:mb-7 relative z-10">
            {/* Official AB Logo */}
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white p-1.5 sm:p-2 shadow-lg shadow-emerald-700/15 border border-emerald-100 flex items-center justify-center mb-2 sm:mb-4 overflow-hidden">
              <img
                src="/brand/anwar-bhuiyan-property.svg"
                alt="Anwar Bhuiyan Property Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isBengali ? 'আনোয়ার ভূঁইয়া প্রপার্টি' : 'Anwar Bhuiyan Property'}
            </h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-semibold text-emerald-800">
              {t('app.tagline')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 sm:mb-5 rounded-2xl bg-red-50/90 backdrop-blur-md border border-red-200 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-4">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                {isBengali ? 'ইউজারনেম / ইমেইল' : 'Username / Email'}
              </label>
              <input
                id="email"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 200);
                }}
                placeholder="zahid"
                disabled={loading}
                className="w-full rounded-xl border border-slate-300/80 bg-white/80 backdrop-blur-xs px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={(e) => {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 200);
                  }}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/80 backdrop-blur-xs px-3.5 py-2.5 pr-11 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-slate-500" />
                  ) : (
                    <Eye className="w-5 h-5 text-slate-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 disabled:opacity-50 cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-xs font-semibold text-slate-700 select-none cursor-pointer"
              >
                {isBengali ? 'মনে রাখুন' : 'Remember me'}
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/25 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 cursor-pointer border border-white/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{t('auth.signingIn')}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>{t('auth.signIn')}</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
        </LiquidGlass>

        {/* Bottom brand */}
        <p className="mt-5 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} {isBengali ? 'আনোয়ার ভূঁইয়া প্রপার্টি' : 'Anwar Bhuiyan Property'} by Zahid&apos;s Verge
        </p>
      </div>
    </div>
  );
}

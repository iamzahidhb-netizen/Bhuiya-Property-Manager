import { Capacitor } from '@capacitor/core';

/**
 * Service Worker Registration and Network Status Manager.
 * 
 * In native Android/iOS Capacitor apps, assets are already bundled locally in the APK.
 * Running a web Service Worker inside the native WebView can cause stale remote cache conflicts.
 * Only register Service Worker on standard web browsers.
 */
export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    if (Capacitor.isNativePlatform()) {
      console.log('[PWA] Native Capacitor platform detected — using local APK bundle directly.');
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

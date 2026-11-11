import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NavigationProvider } from './contexts/NavigationContext';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import LoadingScreen from './components/LoadingScreen';
import AccessRestrictedScreen from './components/AccessRestrictedScreen';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';
import { HyperOSComponentShowcase } from './components/ui/hyperos/HyperOSComponentShowcase';
import { DesignSystemGalleryWrapper } from './components/dev/DesignSystemGallery';
import AppOpeningSplash from './components/splash/AppOpeningSplash';

function AppRouter() {
  const { user, loading: authLoading } = useAuth();
  const { membership, loading: workspaceLoading, error: workspaceError, retryMembershipLookup } = useWorkspace();
  const [showSplash, setShowSplash] = useState(true);

  // Dev-only Preview Modes (completely stripped in production builds)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    if (window.location.search.includes('preview=gallery') || window.location.pathname === '/gallery') {
      return <DesignSystemGalleryWrapper />;
    }
    if (window.location.search.includes('preview=hyperos')) {
      return <HyperOSComponentShowcase />;
    }
  }

  // 1. YouTube-style Opening Brand Reveal Animation on Cold Start
  if (showSplash) {
    return <AppOpeningSplash onFinish={() => setShowSplash(false)} />;
  }

  // 2. Show loading screen while Firebase verifies auth state OR while workspace membership loads
  if (authLoading || (user && workspaceLoading)) {
    return <LoadingScreen />;
  }

  // 3. If unauthenticated, redirect to Login Page
  if (!user) {
    return <LoginPage />;
  }

  // 4. If user is authenticated but has no valid active membership in Firestore, show AccessRestrictedScreen
  if (!membership || membership.status !== 'active') {
    return (
      <AccessRestrictedScreen
        user={user}
        error={workspaceError}
        onRetry={retryMembershipLookup}
      />
    );
  }

  // 5. Render protected Admin Dashboard only when valid active membership is confirmed
  return <AdminDashboard />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <WorkspaceProvider>
            <SettingsProvider>
              <NavigationProvider>
                <OfflineStatusBanner />
                <AppRouter />
              </NavigationProvider>
            </SettingsProvider>
          </WorkspaceProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

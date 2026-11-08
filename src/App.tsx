import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import LoadingScreen from './components/LoadingScreen';
import AccessRestrictedScreen from './components/AccessRestrictedScreen';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';
import { HyperOSComponentShowcase } from './components/ui/hyperos/HyperOSComponentShowcase';

function AppRouter() {
  const { user, loading: authLoading } = useAuth();
  const { membership, loading: workspaceLoading, error: workspaceError, retryMembershipLookup } = useWorkspace();

  // Phase 2 Preview Mode for Xiaomi HyperOS Component Showcase (isolated, non-destructive)
  if (typeof window !== 'undefined' && window.location.search.includes('preview=hyperos')) {
    return <HyperOSComponentShowcase />;
  }

  // Show loading screen while Firebase verifies auth state OR while workspace membership loads
  if (authLoading || (user && workspaceLoading)) {
    return <LoadingScreen />;
  }

  // If unauthenticated, redirect to Login Page
  if (!user) {
    return <LoginPage />;
  }

  // If user is authenticated but has no valid active membership in Firestore, show AccessRestrictedScreen
  if (!membership || membership.status !== 'active') {
    return (
      <AccessRestrictedScreen
        user={user}
        error={workspaceError}
        onRetry={retryMembershipLookup}
      />
    );
  }

  // Render protected Admin Dashboard only when valid active membership is confirmed
  return <AdminDashboard />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <WorkspaceProvider>
            <OfflineStatusBanner />
            <AppRouter />
          </WorkspaceProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import LoadingScreen from './components/LoadingScreen';
import AccessRestrictedScreen from './components/AccessRestrictedScreen';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';

function AppRouter() {
  const { user, loading: authLoading } = useAuth();
  const { membership, loading: workspaceLoading, error: workspaceError, retryMembershipLookup } = useWorkspace();

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
    <AuthProvider>
      <LanguageProvider>
        <WorkspaceProvider>
          <OfflineStatusBanner />
          <AppRouter />
        </WorkspaceProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

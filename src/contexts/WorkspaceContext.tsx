import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { setActiveWorkspaceId } from '../lib/apiClient';

export interface WorkspacePermissions {
  canManageTenants: boolean;
  canCollectRent: boolean;
  canRecordExpenses: boolean;
  canViewReports: boolean;
  [key: string]: boolean;
}

export type WorkspaceRole = 'master_admin' | 'manager' | 'viewer' | 'custom';

export interface WorkspaceMembership {
  workspaceId: string;
  uid: string;
  role: WorkspaceRole;
  status: 'active' | 'inactive' | 'suspended';
  permissions: WorkspacePermissions;
}

export interface WorkspaceContextType {
  membership: WorkspaceMembership | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  status: 'active' | 'inactive' | 'suspended' | null;
  permissions: WorkspacePermissions;
  isMasterAdmin: boolean;
  canManageTenants: boolean;
  canCollectRent: boolean;
  canRecordExpenses: boolean;
  canViewReports: boolean;
  loading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => void;
  canAccessTab: (tabId: string) => boolean;
  retryMembershipLookup: () => void;
}

export const DEFAULT_WORKSPACE_ID = 'workspace_bhuiya_family';

const defaultPermissions: WorkspacePermissions = {
  canManageTenants: false,
  canCollectRent: false,
  canRecordExpenses: false,
  canViewReports: false,
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [membership, setMembership] = useState<WorkspaceMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const retryMembershipLookup = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setActiveWorkspaceId(null);
      Promise.resolve().then(() => {
        if (isMounted) {
          setMembership(null);
          setLoading(false);
          setError(null);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    const currentUid = user.uid;

    async function fetchMembership() {
      setLoading(true);
      setError(null);
      try {
        const targetDocId = `${activeWorkspace}_${currentUid}`;
        const memberDocRef = doc(db, 'workspace_members', targetDocId);
        const snapshot = await getDoc(memberDocRef);

        if (!isMounted) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const rawRole = data.role as string;
          if (!['master_admin', 'manager', 'viewer', 'custom'].includes(rawRole)) {
            setError(`Invalid workspace role: "${rawRole}"`);
            setMembership(null);
            setActiveWorkspaceId(null);
            return;
          }

          const role = rawRole as WorkspaceRole;
          const isMaster = role === 'master_admin';
          const rawPerms = (data.permissions || {}) as Record<string, boolean>;
          const memberRecord: WorkspaceMembership = {
            workspaceId: data.workspaceId || activeWorkspace,
            uid: data.uid || currentUid,
            role,
            status: data.status || 'inactive',
            permissions: {
              ...rawPerms,
              canManageTenants: isMaster || Boolean(rawPerms.canManageTenants || rawPerms.manageTenants || rawPerms.createTenant || rawPerms.viewTenants),
              canCollectRent: isMaster || Boolean(rawPerms.canCollectRent || rawPerms.collectRent || rawPerms.viewRent),
              canRecordExpenses: isMaster || Boolean(rawPerms.canRecordExpenses || rawPerms.addExpense || rawPerms.viewExpenses),
              canViewReports: isMaster || Boolean(rawPerms.canViewReports || rawPerms.viewReports),
            },
          };
          setMembership(memberRecord);
          setActiveWorkspaceId(memberRecord.workspaceId);
          setError(null);
        } else {
          // User is authenticated but is not an active member of this workspace
          setMembership(null);
          setError(null);
          setActiveWorkspaceId(null);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load workspace membership';
        console.warn('[WorkspaceContext] Could not load membership:', msg);
        setMembership(null);
        setActiveWorkspaceId(null);
        // Do not set raw permission-denied errors; AccessRestrictedScreen handles non-membership cleanly
        setError(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchMembership();

    return () => {
      isMounted = false;
    };
  }, [user, activeWorkspace, refreshKey]);

  function switchWorkspace(newWorkspaceId: string) {
    setActiveWorkspace(newWorkspaceId);
    setActiveWorkspaceId(newWorkspaceId);
  }

  const effectiveMembership = user ? membership : null;
  const effectiveLoading = user ? loading : false;
  const role = effectiveMembership?.role || null;
  const isMasterAdmin = role === 'master_admin';
  const permissions: WorkspacePermissions = {
    ...(effectiveMembership?.permissions || {}),
    canManageTenants: isMasterAdmin || Boolean(effectiveMembership?.permissions?.canManageTenants),
    canCollectRent: isMasterAdmin || Boolean(effectiveMembership?.permissions?.canCollectRent),
    canRecordExpenses: isMasterAdmin || Boolean(effectiveMembership?.permissions?.canRecordExpenses),
    canViewReports: isMasterAdmin || Boolean(effectiveMembership?.permissions?.canViewReports),
  };

  function canAccessTab(tabId: string): boolean {
    if (!effectiveMembership || effectiveMembership.status !== 'active') return false;
    if (isMasterAdmin) return true;

    switch (tabId) {
      case 'dashboard':
        return isMasterAdmin || permissions.viewHomeSummary !== false;
      case 'properties':
        return isMasterAdmin || Boolean(permissions.viewProperties) || permissions.canManageTenants;
      case 'tenants':
        return isMasterAdmin || Boolean(permissions.viewTenants) || permissions.canManageTenants;
      case 'rent':
        return isMasterAdmin || Boolean(permissions.viewRent) || permissions.canCollectRent;
      case 'expenses':
        return isMasterAdmin || Boolean(permissions.viewExpenses) || permissions.canRecordExpenses;
      case 'reports':
        return isMasterAdmin || Boolean(permissions.viewReports) || permissions.canViewReports;
      case 'distribution':
        return isMasterAdmin || Boolean(permissions.viewFamilyDistribution) || Boolean(permissions.viewReserveFund);
      default:
        return false;
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{
        membership: effectiveMembership,
        workspaceId: effectiveMembership?.workspaceId || activeWorkspace,
        role,
        status: effectiveMembership?.status || null,
        permissions: effectiveMembership ? permissions : defaultPermissions,
        isMasterAdmin,
        canManageTenants: permissions.canManageTenants,
        canCollectRent: permissions.canCollectRent,
        canRecordExpenses: permissions.canRecordExpenses,
        canViewReports: permissions.canViewReports,
        loading: effectiveLoading,
        error,
        switchWorkspace,
        canAccessTab,
        retryMembershipLookup,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

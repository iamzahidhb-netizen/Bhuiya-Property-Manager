import { callCallable } from '../lib/apiClient';
import type {
  WorkspaceMemberItem,
  UserRole,
  MemberStatus,
} from '../types/userManagement';

export interface ListMembersResponse {
  success: boolean;
  workspaceId: string;
  membersCount: number;
  members: WorkspaceMemberItem[];
}

export interface CreateMemberInput {
  email: string;
  displayName: string;
  role: 'manager' | 'viewer' | 'custom';
  password?: string;
  mobile?: string;
  permissions?: Record<string, boolean>;
  confirmExistingLink?: boolean;
}

export interface CreateMemberResponse {
  success: boolean;
  action: string;
  isNewAccount: boolean;
  requireConfirmation?: boolean;
  member?: WorkspaceMemberItem;
}

export interface UpdatePermissionsInput {
  targetUid: string;
  role: 'manager' | 'viewer' | 'custom';
  permissions: Record<string, boolean>;
}

export interface UpdatePermissionsResponse {
  success: boolean;
  action: string;
  targetUid: string;
  role: UserRole;
  permissions: Record<string, boolean>;
}

export interface UpdateStatusInput {
  targetUid: string;
  status: MemberStatus;
}

export interface UpdateStatusResponse {
  success: boolean;
  action: string;
  targetUid: string;
  status: MemberStatus;
  revoked?: boolean;
}

export interface PasswordResetInput {
  targetUid?: string;
  email?: string;
}

export interface PasswordResetResponse {
  success: boolean;
  action: string;
  email: string;
  resetLink?: string | null;
  message?: string;
}

/**
 * Lists all registered workspace members with roles and permissions.
 * Master Admin ONLY.
 */
export async function listWorkspaceMembers(): Promise<WorkspaceMemberItem[]> {
  const result = await callCallable<Record<string, never>, ListMembersResponse>(
    'listWorkspaceMembersCallable',
    {}
  );
  return result.data?.members || [];
}

/**
 * Creates or securely links a family member to the workspace via Cloudflare Worker.
 * Does NOT sign out or mutate the active Master Admin session.
 */
export async function createWorkspaceMember(
  input: CreateMemberInput
): Promise<CreateMemberResponse> {
  const result = await callCallable<CreateMemberInput, CreateMemberResponse>(
    'createWorkspaceMemberCallable',
    input
  );
  return result.data;
}

/**
 * Updates granular permissions for a workspace member.
 * Master Admin ONLY. Cannot modify Master Admin itself.
 */
export async function updateWorkspaceMemberPermissions(
  input: UpdatePermissionsInput
): Promise<UpdatePermissionsResponse> {
  const result = await callCallable<UpdatePermissionsInput, UpdatePermissionsResponse>(
    'updateWorkspaceMemberPermissionsCallable',
    input
  );
  return result.data;
}

/**
 * Updates member status (active / inactive / suspended / revoked).
 * Master Admin ONLY. Cannot modify Master Admin itself.
 */
export async function updateWorkspaceMemberStatus(
  input: UpdateStatusInput
): Promise<UpdateStatusResponse> {
  const result = await callCallable<UpdateStatusInput, UpdateStatusResponse>(
    'updateWorkspaceMemberStatusCallable',
    input
  );
  return result.data;
}

/**
 * Dispatches an official Firebase Auth password reset email / link for a member.
 * Master Admin ONLY.
 */
export async function sendWorkspaceMemberPasswordReset(
  input: PasswordResetInput
): Promise<PasswordResetResponse> {
  const result = await callCallable<PasswordResetInput, PasswordResetResponse>(
    'sendWorkspaceMemberPasswordResetCallable',
    input
  );
  return result.data;
}
